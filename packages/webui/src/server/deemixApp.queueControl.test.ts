import { describe, expect, it, vi } from "vitest";
import { DeemixApp } from "./deemixApp.js";

describe("persistent download queue pause / resume", () => {
	it("pauses without clearing queued records and resumes with an authenticated session", () => {
		const app = Object.create(DeemixApp.prototype) as DeemixApp;
		app.queueOrder = ["album1", "album2"];
		app.queue = {
			album1: { uuid: "album1", status: "inQueue" },
			album2: { uuid: "album2", status: "inQueue" },
		};
		app.currentJob = null;
		app.queuePaused = false;
		const send = vi.fn();
		app.listener = { send } as any;
		const persist = vi.spyOn(app as any, "persistQueueControl").mockImplementation(() => {});
		const start = vi.spyOn(app, "startQueue").mockImplementation(async () => null);
		app.pauseQueue();
		expect(app.queuePaused).toBe(true);
		expect(persist).toHaveBeenCalledOnce();
		expect(start).not.toHaveBeenCalled();
		expect(app.queueOrder).toEqual(["album1", "album2"]);
		expect(send).toHaveBeenCalledWith("queueStateChanged", { paused: true });
		expect(app.resumeQueue({ loggedIn: false } as any)).toBe(false);
		expect(app.queuePaused).toBe(true);
		expect(app.resumeQueue({ loggedIn: true } as any)).toBe(true);
		expect(app.queuePaused).toBe(false);
		expect(start).toHaveBeenCalledOnce();
		expect(app.queueOrder).toEqual(["album1", "album2"]);
		expect(send).toHaveBeenCalledWith("queueStateChanged", { paused: false });
	});

	it("never dispatches the queue while paused", async () => {
		const app = Object.create(DeemixApp.prototype) as DeemixApp;
		app.queuePaused = true;
		app.queueOrder = ["album1"];
		app.queue = { album1: { uuid: "album1", status: "inQueue" } };
		app.currentJob = null;
		expect(await app.startQueue({ loggedIn: true } as any)).toBeNull();
		expect(app.queueOrder).toEqual(["album1"]);
		expect(app.queue.album1.status).toBe("inQueue");
	});
});
