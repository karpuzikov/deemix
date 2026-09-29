import fs from "fs";
import path from "path";
import type { Deezer } from "deezer-sdk";
import { getConfigFolder } from "./localpaths.js";

type CacheEntry = {
	trackID: string;
	updatedAt: number;
};

type CacheFile = Record<string, CacheEntry>;

const CACHE_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const inflight = new Map<string, Promise<string | null>>();
let loaded = false;
let cache: CacheFile = {};

export function normalizeISRC(value: unknown): string {
	return String(value ?? "")
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, "");
}

function cachePath(): string {
	return path.join(getConfigFolder(), "isrc-fallback-cache.json");
}

function ensureLoaded(): void {
	if (loaded) return;
	loaded = true;
	try {
		const parsed = JSON.parse(fs.readFileSync(cachePath(), "utf8"));
		if (parsed && typeof parsed === "object") cache = parsed;
	} catch {
		cache = {};
	}
}

function persist(): void {
	try {
		fs.mkdirSync(getConfigFolder(), { recursive: true });
		fs.writeFileSync(cachePath(), JSON.stringify(cache, null, 2));
	} catch {
		/* Cache failures must never break downloads. */
	}
}

export function getCachedISRCTrackID(isrc: unknown): string | null {
	ensureLoaded();
	const key = normalizeISRC(isrc);
	if (!key) return null;
	const entry = cache[key];
	if (!entry) return null;
	if (Date.now() - entry.updatedAt > CACHE_TTL_MS) {
		delete cache[key];
		persist();
		return null;
	}
	return entry.trackID || null;
}

export function putCachedISRCTrackID(isrc: unknown, trackID: unknown): void {
	ensureLoaded();
	const key = normalizeISRC(isrc);
	const id = String(trackID ?? "").trim();
	if (!key || !id || id === "0") return;
	cache[key] = { trackID: id, updatedAt: Date.now() };
	persist();
}

export function invalidateCachedISRCTrackID(isrc: unknown, trackID?: unknown): void {
	ensureLoaded();
	const key = normalizeISRC(isrc);
	if (!key || !cache[key]) return;
	if (trackID !== undefined && cache[key].trackID !== String(trackID)) return;
	delete cache[key];
	persist();
}

export async function resolveISRCTrackID(
	dz: Deezer,
	isrc: unknown
): Promise<string | null> {
	const key = normalizeISRC(isrc);
	if (!key) return null;

	const cached = getCachedISRCTrackID(key);
	if (cached) return cached;

	const existing = inflight.get(key);
	if (existing) return existing;

	const request = (async () => {
		try {
			const track = await dz.api.getTrack(`isrc:${key}`);
			if (!track?.id || normalizeISRC(track.isrc) !== key) return null;
			const id = String(track.id);
			putCachedISRCTrackID(key, id);
			return id;
		} catch {
			return null;
		} finally {
			inflight.delete(key);
		}
	})();

	inflight.set(key, request);
	return request;
}
