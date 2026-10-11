import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

import { DeemixApp } from "./deemixApp.js";
import { Downloader } from "deemix";

const dirs: string[] = [];
afterEach(() => {
	vi.restoreAllMocks();
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function makeApp() {
	const dir = mkdtempSync(join(tmpdir(), "deemix-queue-controls-"));
	dirs.push(dir);
	const app = Object.create(DeemixApp.prototype) as any;
	const send = vi.fn();
	app.queue = {};
	app.queueOrder = [];
	app.currentJob = null;
	app.queuePaused = false;
	app.stopRequested = false;
	app.listener = { send };
	app.settings = {};
	app.plugins = {};
	app.getEffectiveSettings = () => ({});
	app.queueFile = (uuid: string) => join(dir, uuid + ".json");
	app.writeQueueJson = (filename: string, value: unknown) =>
		writeFileSync(filename, JSON.stringify(value), "utf8");
	app.persistQueueControl = vi.fn();
	app.persistQueueOrder = vi.fn();
	app.removeQueueFile = vi.fn((uuid: string) => rmSync(app.queueFile(uuid), { force: true }));
	return { app, dir, send };
}

describe("lightweight queue lifecycle", () => {
	it("pauses without removing queued releases and resumes without regenerating artist lists", () => {
		const { app, send } = makeApp();
		app.queueOrder = ["album_7_9"];
		app.queue.album_7_9 = { uuid: "album_7_9", status: "inQueue" };
		const start = vi.spyOn(app, "startQueue").mockResolvedValue(null);
		expect(app.pauseQueue().paused).toBe(true);
		expect(app.getQueue().paused).toBe(true);
		expect(app.queueOrder).toEqual(["album_7_9"]);
		expect(app.resumeQueue({} as any).paused).toBe(false);
		expect(start).toHaveBeenCalledOnce();
		expect(send).toHaveBeenCalledWith("queueResumed", { paused: false });
	});

	it("removes only queue entries with errors and leaves files on disk untouched", () => {
		const { app, dir } = makeApp();
		const statuses = ["failed", "withErrors", "completed", "inQueue", "downloading"];
		const audio = join(dir, "music.flac");
		writeFileSync(audio, "previously downloaded");
		for (const [index, status] of statuses.entries()) {
			const uuid = "album_" + index;
			app.queue[uuid] = { uuid, status, errors: [] };
			writeFileSync(app.queueFile(uuid), "{}");
		}
		expect(app.removeDownloadsWithErrors()).toBe(2);
		expect(Object.keys(app.queue)).toEqual(["album_2", "album_3", "album_4"]);
		expect(existsSync(audio)).toBe(true);
	});

	it("stop removes only files created in the current attempt and restores full queued payload", async () => {
		const { app, dir, send } = makeApp();
		const uuid = "album_99_9";
		const queued = {
			__type__: "Collection", uuid, type: "album", id: 99,
			bitrate: 9, title: "Album", artist: "Artist", cover: "",
			size: 2, downloaded: 0, failed: 0, errors: [], files: [],
			collection: { tracks: [], albumAPI: { id: 99, title: "Album" } },
		};
		app.queueOrder = [uuid];
		app.queue[uuid] = { ...queued, status: "inQueue" };
		writeFileSync(app.queueFile(uuid), JSON.stringify({ ...queued, status: "inQueue" }));
		const prior = join(dir, "preexisting.flac");
		const owned = join(dir, "created.flac");
		writeFileSync(prior, "pre-existing");
		let release: () => void = () => {};
		vi.spyOn(Downloader.prototype, "start").mockImplementation(async function (this: Downloader) {
			writeFileSync(owned, "new");
			this.createdFiles.add(owned);
			await new Promise<void>(resolve => { release = resolve; });
		});
		const work = app.startQueue({} as any);
		expect(app.queue[uuid].status).toBe("downloading");
		expect(app.stopQueue().stopping).toBe(true);
		expect((app.currentJob as Downloader).downloadObject.isCanceled).toBe(true);
		release();
		await work;
		expect(existsSync(prior)).toBe(true);
		expect(existsSync(owned)).toBe(false);
		expect(app.queue[uuid].status).toBe("inQueue");
		expect(app.queueOrder).toEqual([uuid]);
		expect(JSON.parse(readFileSync(app.queueFile(uuid), "utf8")).collection.tracks).toEqual([]);
		expect(send).toHaveBeenCalledWith("queueReleaseStopped", {
			uuid, removed: 1, failed: 0,
		});
		expect(app.queuePaused).toBe(true);
	});
});
