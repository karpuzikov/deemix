import { eachLimit } from "async";
import got from "got";
import type { Deezer } from "deezer-sdk";
import { isSameReleaseArtist } from "./releaseVariants.js";

type RootArtist = {
	id?: string | number;
	name?: string;
};

type MusicBrainzRelation = {
	"target-type"?: string;
	artist?: {
		id?: string;
		name?: string;
	};
};

type MusicBrainzUrlLookup = {
	relations?: MusicBrainzRelation[];
};

type MusicBrainzRelease = {
	barcode?: string | null;
	status?: string | null;
};

type MusicBrainzReleaseBrowse = {
	"release-count"?: number;
	count?: number;
	releases?: MusicBrainzRelease[];
};

const MUSICBRAINZ_BASE = "https://musicbrainz.org/ws/2";
const MUSICBRAINZ_USER_AGENT =
	"deemix-karpuzikov/3.14.0 (https://github.com/karpuzikov/deemix)";
const MUSICBRAINZ_MIN_INTERVAL_MS = 1100;
const MAX_MUSICBRAINZ_RELEASES = 10000;
const DEEZER_UPC_CONCURRENCY = 4;

let nextMusicBrainzRequestAt = 0;
let musicBrainzRequestChain: Promise<void> = Promise.resolve();

function normalizeBarcode(value: unknown): string {
	const barcode = String(value ?? "").replace(/\D/g, "");
	if (!barcode || /^0+$/.test(barcode)) return "";
	if (barcode.length < 8 || barcode.length > 14) return "";
	return barcode;
}

export function getMusicBrainzArtistId(
	lookup: MusicBrainzUrlLookup
): string | null {
	for (const relation of lookup?.relations ?? []) {
		if (
			relation?.["target-type"] === "artist" &&
			typeof relation?.artist?.id === "string" &&
			relation.artist.id
		) {
			return relation.artist.id;
		}
	}
	return null;
}

export function collectMusicBrainzBarcodes(
	releases: MusicBrainzRelease[]
): string[] {
	const result = new Set<string>();

	for (const release of releases ?? []) {
		if (release?.status && release.status !== "Official") continue;
		const barcode = normalizeBarcode(release?.barcode);
		if (barcode) result.add(barcode);
	}

	return Array.from(result);
}

async function musicBrainzJSON<T>(
	endpoint: string,
	searchParams: Record<string, string | number>
): Promise<T> {
	let result!: T;
	let failure: unknown;

	const task = musicBrainzRequestChain.then(async () => {
		const delay = Math.max(0, nextMusicBrainzRequestAt - Date.now());
		if (delay > 0) {
			await new Promise((resolve) => setTimeout(resolve, delay));
		}
		nextMusicBrainzRequestAt = Date.now() + MUSICBRAINZ_MIN_INTERVAL_MS;

		try {
			result = await got
				.get(`${MUSICBRAINZ_BASE}/${endpoint}`, {
					searchParams,
					headers: {
						"User-Agent": MUSICBRAINZ_USER_AGENT,
					},
					timeout: {
						request: 20000,
					},
					retry: {
						limit: 2,
					},
				})
				.json<T>();
		} catch (error) {
			failure = error;
		}
	});

	musicBrainzRequestChain = task.then(
		() => undefined,
		() => undefined
	);
	await task;

	if (failure) throw failure;
	return result;
}

function albumBelongsToArtist(album: any, rootArtist: RootArtist): boolean {
	if (isSameReleaseArtist(rootArtist, album?.artist)) return true;

	const contributors = Array.isArray(album?.contributors)
		? album.contributors
		: [];

	return contributors.some((artist: any) =>
		isSameReleaseArtist(rootArtist, artist)
	);
}

async function resolveMusicBrainzArtistId(
	rootArtist: RootArtist
): Promise<string | null> {
	const artistID = String(rootArtist?.id ?? "").trim();
	if (!artistID) return null;

	const resources = [
		`https://www.deezer.com/artist/${artistID}`,
		`https://deezer.com/artist/${artistID}`,
	];

	for (const resource of resources) {
		try {
			const lookup = await musicBrainzJSON<MusicBrainzUrlLookup>("url", {
				resource,
				inc: "artist-rels",
				fmt: "json",
			});
			const mbid = getMusicBrainzArtistId(lookup);
			if (mbid) return mbid;
		} catch {
			/* Try the next canonical Deezer URL spelling. */
		}
	}

	return null;
}

async function getMusicBrainzArtistBarcodes(
	musicBrainzArtistID: string
): Promise<string[]> {
	const barcodes = new Set<string>();
	let offset = 0;
	let total = Number.POSITIVE_INFINITY;

	while (
		offset < total &&
		offset < MAX_MUSICBRAINZ_RELEASES
	) {
		const page = await musicBrainzJSON<MusicBrainzReleaseBrowse>("release", {
			artist: musicBrainzArtistID,
			limit: 100,
			offset,
			fmt: "json",
		});

		const releases = Array.isArray(page?.releases) ? page.releases : [];
		for (const barcode of collectMusicBrainzBarcodes(releases)) {
			barcodes.add(barcode);
		}

		total = Number(
			page?.["release-count"] ??
				page?.count ??
				Number.POSITIVE_INFINITY
		);

		if (releases.length === 0) break;
		offset += releases.length;
	}

	return Array.from(barcodes);
}

async function getDeezerAlbumByBarcode(
	dz: Deezer,
	barcode: string
): Promise<any | null> {
	const attempts = Array.from(
		new Set([
			barcode,
			barcode.replace(/^0+(?=\d)/, ""),
		])
	).filter(Boolean);

	for (const upc of attempts) {
		try {
			const album: any = await dz.api.get_album_by_UPC(upc);
			if (album?.id) return album;
		} catch {
			/* This MusicBrainz release is not present on Deezer. */
		}
	}

	return null;
}

export async function discoverMusicBrainzDeezerAlbums(
	dz: Deezer,
	rootArtist: RootArtist
): Promise<any[]> {
	const musicBrainzArtistID = await resolveMusicBrainzArtistId(rootArtist);
	if (!musicBrainzArtistID) return [];

	const barcodes = await getMusicBrainzArtistBarcodes(musicBrainzArtistID);
	if (!barcodes.length) return [];

	const albums = new Map<string, any>();

	await eachLimit(
		barcodes,
		DEEZER_UPC_CONCURRENCY,
		async (barcode: string) => {
			const album = await getDeezerAlbumByBarcode(dz, barcode);
			if (!album?.id) return;
			if (!albumBelongsToArtist(album, rootArtist)) return;
			albums.set(String(album.id), album);
		}
	);

	return Array.from(albums.values());
}
