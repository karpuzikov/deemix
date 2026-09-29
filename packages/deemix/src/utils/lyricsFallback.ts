import got from "got";
import type Track from "../types/Track.js";

type LRCLibResponse = {
	plainLyrics?: string | null;
	syncedLyrics?: string | null;
};

const inflight = new Map<string, Promise<LRCLibResponse | null>>();

function keyFor(track: Track): string {
	return [
		track.mainArtist?.name || "",
		track.title || "",
		track.album?.title || "",
		Math.round(track.duration || 0),
	]
		.join("|")
		.toLowerCase();
}

export async function enrichLyricsFromLRCLIB(track: Track): Promise<boolean> {
	if (!track?.lyrics || !track.mainArtist?.name || !track.title) return false;
	if (track.lyrics.sync || track.lyrics.unsync) return false;

	const key = keyFor(track);
	let request = inflight.get(key);
	if (!request) {
		request = (async () => {
			try {
				return await got
					.get("https://lrclib.net/api/get", {
						searchParams: {
							artist_name: track.mainArtist?.name || "",
							track_name: track.title,
							album_name: track.album?.title || "",
							duration: Math.round(track.duration || 0),
						},
						timeout: { request: 15000 },
						retry: { limit: 2 },
					})
					.json<LRCLibResponse>();
			} catch {
				return null;
			} finally {
				inflight.delete(key);
			}
		})();
		inflight.set(key, request);
	}

	const result = await request;
	if (!result) return false;

	if (result.plainLyrics) track.lyrics.unsync = result.plainLyrics.trim();
	if (result.syncedLyrics) {
		track.lyrics.sync = result.syncedLyrics
			.replace(/\r?\n/g, "\r\n")
			.trimEnd() + "\r\n";
	}

	return Boolean(track.lyrics.sync || track.lyrics.unsync);
}
