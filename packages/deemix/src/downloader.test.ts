import { existsSync, mkdtempSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { describe, expect, it, vi } from "vitest";

import { Collection } from "./download-objects/Collection.js";
import { Downloader } from "./downloader.js";

describe("Downloader.afterDownloadCollection", () => {
	it("still creates m3u8 when a track entry is missing", async () => {
		const downloadLocation = mkdtempSync(join(tmpdir(), "deemix-test-"));

		const downloadObject = new Collection({
			type: "playlist",
			id: "123",
			bitrate: 1,
			title: "Regression Playlist",
			artist: "Spotify",
			cover: "",
			size: 2,
			explicit: false,
			collection: {
				tracks: [],
				playlistAPI: {
					title: "Regression Playlist",
				},
			},
		});

		const settings = {
			downloadLocation,
			createM3U8File: true,
			playlistFilenameTemplate: "%title%",
			illegalCharacterReplacer: "_",
			logErrors: false,
			logSearched: false,
			saveArtwork: false,
			saveArtworkArtist: false,
			tags: {
				savePlaylistAsCompilation: false,
			},
			executeCommand: "",
		} as any;

		const downloader = new Downloader({} as any, downloadObject, settings, {
			send: vi.fn(),
		} as any);

		await downloader.afterDownloadCollection([
			undefined,
			{
				filename: "Artist - Song.mp3",
				data: { artist: "Artist", title: "Song" },
			},
		]);

		const playlistFile = join(downloadLocation, "Regression Playlist.m3u8");
		expect(existsSync(playlistFile)).toBe(true);
		expect(readFileSync(playlistFile, "utf8").trim()).toBe("Artist - Song.mp3");
	});
});

describe("Strict album quality: no incomplete releases", () => {
	const album = () => new Collection({
		type: "album", id: "998", bitrate: 9,
		title: "Album At Requested Quality", artist: "Artist", cover: "",
		size: 3, explicit: true,
		collection: {
			tracks: ["First", "Second", "Third"].map((title, i) => ({
				id: i + 1, title, artist: { name: "Artist" },
			})),
			albumAPI: { id: 998, title: "Album At Requested Quality" },
		},
	} as any);
	const mkDownloader = () => {
		const d = new Downloader({} as any, album(), {
			downloadLocation: "unneeded",
			dontDownloadIncompleteReleases: true,
			fallbackBitrate: true,
			fallbackISRC: true,
			queueConcurrency: 1,
		} as any, { send: vi.fn() } as any);
		vi.spyOn(d, "findExistingCompleteRelease").mockReturnValue({
			complete: false, folder: "",
		});
		return d;
	};
	it("skips the whole album if one track is unavailable at requested quality", async () => {
		const d = mkDownloader();
		vi.spyOn(d, "findUnavailableReleaseTracks").mockResolvedValue([{
			id: 2, title: "Second", artist: "Artist",
			reason: "Desired quality unavailable",
		}]);
		const downloader = vi.spyOn(d, "downloadWrapper");
		await d.start();
		expect(d.downloadObject.downloaded).toBe(0);
		expect(d.downloadObject.errors[0].message).toContain("No tracks were downloaded");
		expect(downloader).not.toHaveBeenCalled();
	});
	it("treats unknown, lower-bitrate and timed-out probes as unavailable", async () => {
		const d = mkDownloader();
		const spy = vi.spyOn(d, "downloadWrapper")
			.mockResolvedValueOnce({ probeAvailable: true, bitrate: 9 } as any)
			.mockResolvedValueOnce({ probeAvailable: true, bitrate: 3 } as any)
			.mockResolvedValueOnce({ probeIndeterminate: true } as any);
		const blocked = await d.findUnavailableReleaseTracks();
		expect(spy).toHaveBeenCalledTimes(3);
		expect(blocked.map(x => x.id)).toEqual([2, 3]);
	});
	it("stops if preflight verification itself fails", async () => {
		const d = mkDownloader();
		vi.spyOn(d, "findUnavailableReleaseTracks").mockRejectedValue(new Error("network offline"));
		const wrapper = vi.spyOn(d, "downloadWrapper");
		await d.start();
		expect(d.downloadObject.downloaded).toBe(0);
		expect(d.downloadObject.errors[0].message).toContain("Release skipped");
		expect(wrapper).not.toHaveBeenCalled();
	});
});
