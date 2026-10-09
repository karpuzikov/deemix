const EDITION_SUFFIX_HINT =
	/(?:deluxe|expanded|anniversary|edition|version|integrale|int[eé]grale|d[eé]cennie|remaster(?:ed)?|reissue|bonus|collector|complete|platinum|special|legacy|super deluxe|tour edition)/i;

export function normalizeReleaseTitle(value: string): string {
	return value
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/&/g, " and ")
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
		.replace(/\s+/g, " ");
}

export function getReleaseFamilyTitle(value: string): string {
	let title = value.trim();

	// Deezer commonly represents alternate editions as a trailing bracketed
	// subtitle, e.g. "Album (Deluxe)" or "Album (Décennie)".
	while (/\s*[([{][^\])}]+[\])}]\s*$/.test(title)) {
		title = title.replace(/\s*[([{][^\])}]+[\])}]\s*$/, "").trim();
	}

	// Only strip colon/dash suffixes when they clearly look like edition labels.
	const separatorMatch = title.match(/^(.*?)(?:\s+-\s+|\s*:\s*)(.+)$/);
	if (separatorMatch && EDITION_SUFFIX_HINT.test(separatorMatch[2])) {
		title = separatorMatch[1].trim();
	}

	return title || value.trim();
}

export function isReleaseVariantTitle(seedTitle: string, candidateTitle: string): boolean {
	const seed = normalizeReleaseTitle(seedTitle);
	const candidate = normalizeReleaseTitle(candidateTitle);
	if (!seed || !candidate) return false;
	if (seed === candidate) return true;

	const seedFamily = normalizeReleaseTitle(getReleaseFamilyTitle(seedTitle));
	const candidateFamily = normalizeReleaseTitle(getReleaseFamilyTitle(candidateTitle));
	return Boolean(seedFamily && seedFamily === candidateFamily);
}

export function isSameReleaseArtist(
	rootArtist: { id?: string | number; name?: string },
	candidateArtist?: { id?: string | number; name?: string }
): boolean {
	if (!candidateArtist) return false;
	if (
		rootArtist.id !== undefined &&
		candidateArtist.id !== undefined
	) {
		return String(rootArtist.id) === String(candidateArtist.id);
	}

	return (
		normalizeReleaseTitle(rootArtist.name || "") ===
		normalizeReleaseTitle(candidateArtist.name || "")
	);
}

export function isMainArtistRelease(
	rootArtist: { id?: string | number; name?: string },
	albumAPI: any
): boolean {
	if (!albumAPI) return false;

	// Deezer exposes one primary album artist plus contributor roles. A genuine
	// co-main artist may therefore be present in contributors rather than in the
	// single album.artist field.
	if (isSameReleaseArtist(rootArtist, albumAPI.artist)) return true;

	const contributors = Array.isArray(albumAPI.contributors)
		? albumAPI.contributors
		: [];

	return contributors.some(
		(contributor: any) =>
			String(contributor?.role ?? "").toLowerCase() === "main" &&
			isSameReleaseArtist(rootArtist, contributor)
	);
}

export function isMainArtistDownloadObject(
	rootArtist: { id?: string | number; name?: string },
	downloadObject: any
): boolean {
	const albumAPI =
		downloadObject?.collection?.albumAPI ?? downloadObject?.single?.albumAPI;
	return isMainArtistRelease(rootArtist, albumAPI);
}

export function shouldExpandArtistDiscography(tab: string): boolean {
	return tab === "all" || tab === "discography";
}

function normalizeBarcode(value: unknown): string {
	const barcode = String(value ?? "").replace(/\D/g, "");
	if (!barcode || /^0+$/.test(barcode)) return "";
	return barcode.replace(/^0+(?=\d)/, "");
}

function normalizeISRC(value: unknown): string {
	return String(value ?? "")
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, "");
}

export function getReleaseEditionKey(downloadObject: any): string {
	const albumAPI =
		downloadObject?.collection?.albumAPI ?? downloadObject?.single?.albumAPI;
	const barcode = normalizeBarcode(
		albumAPI?.upc ??
			albumAPI?.barcode ??
			albumAPI?.UPC ??
			albumAPI?.BARCODE
	);
	if (barcode) return `barcode:${barcode}`;

	const tracks =
		downloadObject?.collection?.tracks ??
		(downloadObject?.single?.trackAPI
			? [downloadObject.single.trackAPI]
			: []);

	const trackSignature = tracks
		.map((track: any) => {
			const isrc = normalizeISRC(track?.isrc ?? track?.ISRC);
			if (isrc) return `isrc:${isrc}`;
			const id = track?.id ?? track?.SNG_ID;
			return id !== undefined ? `id:${String(id)}` : "";
		})
		.filter(Boolean)
		.join("|");

	if (trackSignature) return `tracks:${trackSignature}`;
	return `album:${String(downloadObject?.id ?? "unknown")}`;
}

/**
 * A clean/explicit comparison must use the actual release, not just a barcode:
 * both versions usually have different UPCs and Deezer track IDs/ISRCs.
 * Keep different edition labels, track counts and albums with poor overlap.
 */
type Edition = {
	item: any;
	id: string;
	title: string;
	trackTitles: string[];
	explicit: boolean;
	clean: boolean;
	rootArtistID: string;
	artistID: string;
	artistName: string;
};

const CONTENT_MARKER = String.raw`\s*(?:\(|\[)\s*(?:clean|explicit|edited|censored|non[\s-]?explicit)(?:\s+(?:version|edit))?\s*(?:\)|\])\s*`;

function normalizedEditionTitle(title: unknown): string {
	let value = String(title ?? "").trim();
	// Track-level tags also occur *before* the feature credit or twice:
	// "Song [Clean] (feat. Artist)" and "Song [Clean] [Clean]".
	value = value.replace(new RegExp(CONTENT_MARKER, "gi"), " ");
	value = value.replace(
		/\s+[-:]\s*(?:clean|explicit|edited|censored)(?:\s+(?:version|edit))?$/i,
		""
	);
	return normalizeReleaseTitle(value);
}

function hasEditionLabel(value: any, kind: "explicit" | "clean"): boolean {
	const title = String(value?.title ?? "");
	// Literal edition labels only. A record titled "Come Clean" is not
	// automatically a clean edit; nor is "Non Explicit" an explicit label.
	const label = kind === "explicit"
		? /(?:\s*(?:\(|\[)\s*explicit(?:\s+(?:version|edit))?\s*(?:\)|\])|(?:\s+[-:]\s*explicit(?:\s+(?:version|edit))?))\s*$/i
		: /(?:\s*(?:\(|\[)\s*(?:clean|edited|censored|non[\s-]?explicit)(?:\s+(?:version|edit))?\s*(?:\)|\])|(?:\s+[-:]\s*(?:clean|edited|censored|non[\s-]?explicit)(?:\s+(?:version|edit))?))\s*$/i;
	return label.test(title);
}

function hasExplicitMarker(value: any): boolean {
	return value?.explicit === true || value?.explicit === 1 ||
		value?.explicit_lyrics === true || value?.explicit_lyrics === 1 ||
		value?.explicit_content_lyrics === 1 || value?.explicit_content_lyrics === 4 ||
		hasEditionLabel(value, "explicit");
}

function hasCleanMarker(value: any): boolean {
	return value?.explicit_lyrics === false || value?.explicit_lyrics === 0 ||
		value?.explicit_content_lyrics === 0 || value?.explicit_content_lyrics === 3 ||
		hasEditionLabel(value, "clean");
}

function editionOf(item: any): Edition | null {
	if (!item || (item.type !== "album" && item.type !== "track")) return null;
	const album = item.collection?.albumAPI ?? item.single?.albumAPI ?? item.single?.trackAPI?.album;
	const tracks = item.collection?.tracks ??
		(item.single?.trackAPI ? [item.single.trackAPI] : []);
	if (!album || !Array.isArray(tracks) || tracks.length === 0) return null;
	const title = normalizedEditionTitle(album.title ?? item.title);
	const artistName = normalizeReleaseTitle(album.artist?.name ?? item.artist ?? "");
	const trackTitles = tracks.map((track: any) =>
		normalizedEditionTitle(track?.title ?? track?.SNG_TITLE ?? "")
	);
	if (!title || !artistName || trackTitles.some((t: string) => !t)) return null;
	const explicit = hasExplicitMarker(album) || hasExplicitMarker(item) ||
		tracks.some((track: any) => hasExplicitMarker(track));
	const clean = !explicit && (hasCleanMarker(album) ||
		tracks.some((track: any) => hasCleanMarker(track)));
	return {
		item,
		id: String(item.id ?? ""),
		title,
		trackTitles,
		explicit,
		clean,
		rootArtistID: album.root_artist?.id == null ? "" : String(album.root_artist.id),
		artistID: album.artist?.id == null ? "" : String(album.artist.id),
		artistName,
	};
}

function sameArtist(a: Edition, b: Edition): boolean {
	if (a.rootArtistID && b.rootArtistID) return a.rootArtistID === b.rootArtistID;
	if (a.artistID && b.artistID && a.artistID === b.artistID) return true;
	if (a.artistName === b.artistName) return true;
	// Deezer sometimes credits one edition to a main artist and another to
	// main artist + co-main artist. Do not equate unrelated names or "Various".
	const names = (text: string) => text
		.split(/\s+(?:and|feat|featuring|with)\s+|\s*&\s*|\s*,\s*/)
		.map(s => s.trim()).filter(s => s && s !== "various artists");
	const as = names(a.artistName), bs = names(b.artistName);
	return as.some((name: string) => bs.includes(name) && name.length >= 4);
}

function sameRecordings(a: Edition, b: Edition): boolean {
	if (a.trackTitles.length !== b.trackTitles.length) return false;
	const count = a.trackTitles.length;
	let sameSlots = 0;
	for (let i = 0; i < count; i++) {
		if (a.trackTitles[i] === b.trackTitles[i]) sameSlots++;
	}
	// Version-specific censoring alters a small number of Deezer track
	// titles. Require the vast majority of album slots to agree; for short
	// singles and EPs every slot must still agree.
	const required = count >= 8 ? 0.7 : count >= 5 ? 0.8 : 1;
	return sameSlots / count >= required;
}

function isCleanDuplicate(clean: Edition, explicit: Edition): boolean {
	return clean.clean && explicit.explicit &&
		clean.title === explicit.title &&
		sameArtist(clean, explicit) &&
		sameRecordings(clean, explicit);
}

export function preferExplicitReleases<T>(
	incoming: T[],
	waiting: T[] = [],
	active: T[] = []
): { kept: T[]; skipped: T[]; supersededWaiting: T[] } {
	const incomingEditions = incoming.map(editionOf);
	const waitingEditions = waiting.map(editionOf);
	const activeEditions = active.map(editionOf);
	const explicitByTitleAndCount = new Map<string, Edition[]>();
	const insert = (edition: Edition | null) => {
		if (!edition?.explicit) return;
		const key = JSON.stringify([edition.title, edition.trackTitles.length]);
		const group = explicitByTitleAndCount.get(key) ?? [];
		group.push(edition);
		explicitByTitleAndCount.set(key, group);
	};
	incomingEditions.forEach(insert);
	waitingEditions.forEach(insert);
	activeEditions.forEach(insert);
	const duplicate = (candidate: Edition | null) => {
		if (!candidate?.clean) return false;
		const key = JSON.stringify([candidate.title, candidate.trackTitles.length]);
		const potential = explicitByTitleAndCount.get(key) ?? [];
		return potential.some(explicit => isCleanDuplicate(candidate, explicit));
	};
	const kept = incoming.filter((_, index) => !duplicate(incomingEditions[index]));
	const skipped = incoming.filter((_, index) => duplicate(incomingEditions[index]));
	const supersededWaiting = waiting.filter((_, index) => duplicate(waitingEditions[index]));
	return { kept, skipped, supersededWaiting };
}

export function skipCleanWhenExplicitAvailable<T>(items: T[]): T[] {
	return preferExplicitReleases(items).kept;
}
