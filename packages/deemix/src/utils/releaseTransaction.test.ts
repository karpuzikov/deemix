import { describe, expect, it, vi } from "vitest";
import {
  existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync,
  rmSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Collection } from "../download-objects/Collection.js";
import { Downloader } from "../downloader.js";
import { ReleaseTransaction, recoverReleaseTransactions } from "./releaseTransaction.js";

function fixture(fn: (root: string) => void) {
  const root = mkdtempSync(join(tmpdir(), "deemix-quality-"));
  try { fn(root); } finally { rmSync(root, { recursive: true, force: true }); }
}

describe("Strict release publication", () => {
  it("publishes every file and deletes the private stage on success", () => fixture(root => {
    const tx = new ReleaseTransaction(root);
    mkdirSync(join(tx.stage, "Artist", "Album"), { recursive: true });
    writeFileSync(join(tx.stage, "Artist", "Album", "01.flac"), "FLAC");
    writeFileSync(join(tx.stage, "Artist", "Album", "02.flac"), "FLAC");
    writeFileSync(join(tx.stage, "Artist", "Album", "cover.jpg"), "cover");
    tx.publish();
    tx.dispose();
    expect(readFileSync(join(root, "Artist", "Album", "02.flac"), "utf8")).toBe("FLAC");
    expect(existsSync(tx.stage)).toBe(false);
  }));
  it("does not publish any staged files after a track failure", () => fixture(root => {
    writeFileSync(join(root, "my-original.flac"), "untouched");
    const tx = new ReleaseTransaction(root);
    writeFileSync(join(tx.stage, "first.flac"), "partial");
    tx.dispose();
    expect(existsSync(join(root, "first.flac"))).toBe(false);
    expect(readFileSync(join(root, "my-original.flac"), "utf8")).toBe("untouched");
  }));
  it("fails closed on collisions without removing a previously downloaded track", () => fixture(root => {
    mkdirSync(join(root, "Album"));
    writeFileSync(join(root, "Album", "01.flac"), "old");
    const tx = new ReleaseTransaction(root);
    mkdirSync(join(tx.stage, "Album"));
    writeFileSync(join(tx.stage, "Album", "01.flac"), "new");
    writeFileSync(join(tx.stage, "Album", "02.flac"), "new");
    expect(() => tx.publish()).toThrow(/Existing release file/);
    tx.dispose();
    expect(readFileSync(join(root, "Album", "01.flac"), "utf8")).toBe("old");
    expect(existsSync(join(root, "Album", "02.flac"))).toBe(false);
  }));
  it("recovers an abandoned partial publish without removing unrelated music", () => fixture(root => {
    const tx = new ReleaseTransaction(root);
    writeFileSync(join(root, "unrelated.flac"), "old");
    writeFileSync(join(tx.stage, "owned.flac"), "new");
    linkSync(join(tx.stage, "owned.flac"), join(root, "owned.flac"));
    writeFileSync(join(tx.stage, ".deemix-release-stage.json"), JSON.stringify({
      version: 1, destination: root, pid: 2147483647, phase: "publishing",
    }));
    recoverReleaseTransactions(root);
    expect(existsSync(join(root, "owned.flac"))).toBe(false);
    expect(readFileSync(join(root, "unrelated.flac"), "utf8")).toBe("old");
    expect(existsSync(tx.stage)).toBe(false);
  }));
});

function geoAlbum() {
  return new Collection({
    type: "album", id: "53346642", bitrate: 9,
    title: "Deezer 53346642", artist: "Inna", cover: "",
    size: 2,
    collection: {
      tracks: [
        { id: 440060361, title: "First", artist: { name: "Inna" } },
        { id: 440060362, title: "My Dreams", artist: { name: "Inna" } },
      ],
      albumAPI: { id: 53346642, title: "Deezer 53346642" },
    },
  } as any);
}

describe("Album geo / selected quality regression - Deezer 53346642", () => {
  it("preflight country-blocked 440060362 never creates release files", async () => {
    const root = mkdtempSync(join(tmpdir(), "deemix-geo-preflight-"));
    try {
      const d = new Downloader({} as any, geoAlbum(), {
        downloadLocation: root, dontDownloadIncompleteReleases: true,
        queueConcurrency: 1,
      } as any, { send: vi.fn() } as any);
      vi.spyOn(d, "findExistingCompleteRelease").mockReturnValue({ complete: false, folder: "" });
      vi.spyOn(d, "findUnavailableReleaseTracks").mockResolvedValue([{
        id: 440060362, title: "My Dreams", artist: "Inna",
        reason: "Your account can't stream the track from your current country and no alternative found.",
      }]);
      const called = vi.spyOn(d, "downloadWrapper");
      await d.start();
      expect(called).not.toHaveBeenCalled();
      expect(d.downloadObject.downloaded).toBe(0);
      expect(existsSync(join(root, "First.flac"))).toBe(false);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it("stream failure after first FLAC rolls back every new track", async () => {
    const root = mkdtempSync(join(tmpdir(), "deemix-geo-stream-"));
    try {
      writeFileSync(join(root, "original.flac"), "original");
      const events: Array<{ event: string; data: any }> = [];
      const d = new Downloader({} as any, geoAlbum(), {
        downloadLocation: root, dontDownloadIncompleteReleases: true,
        queueConcurrency: 1, fallbackBitrate: true,
        logErrors: false, logSearched: false, saveArtwork: false,
        saveArtworkArtist: false, createM3U8File: false, executeCommand: "",
        tags: {},
      } as any, { send: (event, data) => events.push({ event, data }) } as any);
      vi.spyOn(d, "findExistingCompleteRelease").mockReturnValue({ complete: false, folder: "" });
      vi.spyOn(d, "findUnavailableReleaseTracks").mockResolvedValue([]);
      vi.spyOn(d, "afterDownloadCollection").mockResolvedValue(undefined);
      vi.spyOn(d, "downloadWrapper").mockImplementation(async extra => {
        if (extra.trackAPI.id === 440060362) {
          return { error: { message:
            "Your account can't stream the track from your current country and no alternative found." } } as any;
        }
        const path = join(d.settings.downloadLocation, "01 First.flac");
        writeFileSync(path, "FLAC");
        d.downloadObject.downloaded++;
        d.downloadObject.files.push({ path });
        return { path, bitrate: 9, filename: "01 First.flac" } as any;
      });
      await d.start();
      expect(d.downloadObject.downloaded).toBe(0);
      expect(d.downloadObject.files).toEqual([]);
      expect(d.downloadObject.errors.some((e: any) => e.message.includes("My Dreams"))).toBe(true);
      expect(readFileSync(join(root, "original.flac"), "utf8")).toBe("original");
      expect(existsSync(join(root, "01 First.flac"))).toBe(false);
      expect(events.some(e => e.event === "updateQueue" && e.data.resetDownloaded)).toBe(true);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
