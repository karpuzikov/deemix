import fs from "fs";
import { musicBrainzJSON } from "./musicbrainzHttp.js";
import path from "path";
import Track from "../types/Track.js";
import { getConfigFolder } from "./localpaths.js";

type CachedMetadata = {
	genres: string[];
	label: string;
	updatedAt: number;
};

type CacheFile = Record<string, CachedMetadata>;

type RecordingSearchResponse = {
	recordings?: Array<{ id?: string }>;
};

type RecordingResponse = {
	genres?: Array<{ name?: string; count?: number }>;
	releases?: Array<{ id?: string; title?: string }>;
};

type ReleaseResponse = {
	"label-info"?: Array<{ label?: { name?: string } }>;
};

const CACHE_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const USER_AGENT = "Deemix/0.5.0 (https://github.com/karpuzikov/deemix)";
const inflight = new Map<string, Promise<CachedMetadata>>();
let cacheLoaded = false;
let cache: CacheFile = {};

export function normalizeMusicBrainzText(value: unknown): string {
	return String(value ?? "")
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
		.replace(/\s+/g, " ");
}

function cachePath(): string {
	return path.join(getConfigFolder(), "musicbrainz-metadata-cache.json");
}

function ensureCacheLoaded(): void {
	if (cacheLoaded) return;
	cacheLoaded = true;
	try {
		const parsed = JSON.parse(fs.readFileSync(cachePath(), "utf8"));
		if (parsed && typeof parsed === "object") cache = parsed;
	} catch {
		cache = {};
	}
}

function persistCache(): void {
	try {
		fs.mkdirSync(getConfigFolder(), { recursive: true });
		fs.writeFileSync(cachePath(), JSON.stringify(cache, null, 2));
	} catch {
		/* Metadata cache failures must never break downloads. */
	}
}

function albumKey(track: Track): string {
	const barcode = String(track.album?.barcode ?? "").replace(/\D/g, "");
	if (barcode && barcode !== "0") return `upc:${barcode.replace(/^0+(?=\d)/, "")}|isrc:${String(track.ISRC ?? "").toUpperCase()}`;

	return `album:${normalizeMusicBrainzText(track.mainArtist?.name)}|${normalizeMusicBrainzText(
		track.album?.title
	)}`;
}

async function resolveMetadata(track: Track): Promise<CachedMetadata> {
	const result: CachedMetadata = {
		genres: [],
		label: "",
		updatedAt: Date.now(),
	};

	const isrc = String(track.ISRC ?? "")
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, "");
	if (!isrc) return result;

	try {
		const search = await musicBrainzJSON<RecordingSearchResponse>("recording", {
			query: `isrc:${isrc}`,
			fmt: "json",
			limit: 5,
		});
		const recordingID = search.recordings?.find((item) => item.id)?.id;
		if (!recordingID) return result;

		const recording = await musicBrainzJSON<RecordingResponse>(
			`recording/${recordingID}`,
			{ fmt: "json", inc: "releases+genres" }
		);

		result.genres = (recording.genres ?? [])
			.filter((genre) => genre.name)
			.sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
			.map((genre) => String(genre.name))
			.slice(0, 5);

		const targetAlbum = normalizeMusicBrainzText(track.album?.title);
		const release =
			recording.releases?.find(
				(candidate) =>
					candidate.id && targetAlbum &&
					normalizeMusicBrainzText(candidate.title) === targetAlbum
			);

		if (release?.id) {
			try {
				const releaseData = await musicBrainzJSON<ReleaseResponse>(
					`release/${release.id}`,
					{ fmt: "json", inc: "labels" }
				);
				result.label =
					releaseData["label-info"]?.find((entry) => entry.label?.name)?.label
						?.name ?? "";
			} catch {
				/* Genre fallback is still useful when the label lookup fails. */
			}
		}
	} catch {
		/* External metadata is optional. */
	}

	return result;
}

export async function enrichMetadataFromMusicBrainz(track: Track): Promise<boolean> {
	if (!track?.album) return false;

	const missingGenre = track.album.genre.length === 0;
	const missingLabel =
		!track.album.label ||
		track.album.label === "Unknown" ||
		track.album.label.trim() === "";
	if (!missingGenre && !missingLabel) return false;

	ensureCacheLoaded();
	const key = albumKey(track);
	const cached = cache[key];
	let metadata: CachedMetadata;

	if (cached && Date.now() - cached.updatedAt <= CACHE_TTL_MS) {
		metadata = cached;
	} else {
		let request = inflight.get(key);
		if (!request) {
			request = resolveMetadata(track).finally(() => inflight.delete(key));
			inflight.set(key, request);
		}
		metadata = await request;
		cache[key] = metadata;
		persistCache();
	}

	let changed = false;
	if (missingGenre && metadata.genres.length) {
		track.album.genre.push(...metadata.genres);
		changed = true;
	}
	if (missingLabel && metadata.label) {
		track.album.label = metadata.label;
		changed = true;
	}

	return changed;
}
