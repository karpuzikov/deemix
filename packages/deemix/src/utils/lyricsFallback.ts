import got from "got";
import type Track from "../types/Track.js";

type LRCLibResponse = {
	trackName?: string | null;
	artistName?: string | null;
	albumName?: string | null;
	duration?: number | null;
	plainLyrics?: string | null;
	syncedLyrics?: string | null;
};

const inflight = new Map<string, Promise<LRCLibResponse | null>>();

export function normalizeLyricsLookupText(value: unknown): string {
	return String(value ?? "")
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
		.replace(/\s+/g, " ");
}

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

async function exactLookup(track: Track): Promise<LRCLibResponse | null> {
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
	}
}

async function searchLookup(track: Track): Promise<LRCLibResponse | null> {
	let results: LRCLibResponse[];
	try {
		results = await got
			.get("https://lrclib.net/api/search", {
				searchParams: {
					artist_name: track.mainArtist?.name || "",
					track_name: track.title,
				},
				timeout: { request: 15000 },
				retry: { limit: 2 },
			})
			.json<LRCLibResponse[]>();
	} catch {
		return null;
	}

	const targetArtist = normalizeLyricsLookupText(track.mainArtist?.name);
	const targetTitle = normalizeLyricsLookupText(track.title);
	const targetAlbum = normalizeLyricsLookupText(track.album?.title);
	const targetDuration = Number(track.duration || 0);

	const candidates = results
		.filter(
			(result) =>
				normalizeLyricsLookupText(result.artistName) === targetArtist &&
				normalizeLyricsLookupText(result.trackName) === targetTitle &&
				Boolean(result.syncedLyrics || result.plainLyrics)
		)
		.map((result) => {
			let score = result.syncedLyrics ? 3 : 1;
			if (
				targetAlbum &&
				normalizeLyricsLookupText(result.albumName) === targetAlbum
			) {
				score += 3;
			}
			if (
				targetDuration > 0 &&
				typeof result.duration === "number" &&
				Math.abs(result.duration - targetDuration) <= 3
			) {
				score += 3;
			}
			return { result, score };
		})
		.sort((a, b) => b.score - a.score);

	return candidates[0]?.result ?? null;
}

export async function enrichLyricsFromLRCLIB(track: Track): Promise<boolean> {
	if (!track?.lyrics || !track.mainArtist?.name || !track.title) return false;
	if (track.lyrics.sync || track.lyrics.unsync) return false;

	const key = keyFor(track);
	let request = inflight.get(key);
	if (!request) {
		request = (async () => {
			const exact = await exactLookup(track);
			if (exact?.syncedLyrics || exact?.plainLyrics) return exact;
			return searchLookup(track);
		})().finally(() => {
			inflight.delete(key);
		});
		inflight.set(key, request);
	}

	const result = await request;
	if (!result) return false;

	if (result.plainLyrics) track.lyrics.unsync = result.plainLyrics.trim();
	if (result.syncedLyrics) {
		track.lyrics.sync =
			result.syncedLyrics.replace(/\r?\n/g, "\r\n").trimEnd() + "\r\n";
	}

	return Boolean(track.lyrics.sync || track.lyrics.unsync);
}
