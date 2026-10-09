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
 * Match complete releases only. A clean copy is skipped when its explicit
 * equivalent is among the releases actually generated for this download.
 * Never collapse playlists, different tracklists, or distinct edition titles.
 */
function normalizedEditionTitle(title: unknown): string {
	let value = String(title ?? "").trim();
	const suffix = /(?:\s*[([]\s*(?:clean|explicit)(?:\s+(?:version|edit))?\s*[)\]]|\s+[-:]\s*(?:clean|explicit)(?:\s+(?:version|edit))?)$/i;
	let previous = "";
	while (value && previous !== value) {
		previous = value;
		value = value.replace(suffix, "").trim();
	}
	return normalizeReleaseTitle(value);
}

function isExplicit(value: any): boolean {
	return value?.explicit === true || value?.explicit === 1 ||
		value?.explicit_lyrics === true || value?.explicit_lyrics === 1 ||
		value?.explicit_content_lyrics === 1 || value?.explicit_content_lyrics === 4;
}

function isKnownClean(value: any): boolean {
	return value?.explicit_lyrics === false || value?.explicit_lyrics === 0 ||
		value?.explicit_content_lyrics === 0 || value?.explicit_content_lyrics === 3 ||
		/\bclean(?:\s+version)?\b/i.test(String(value?.title ?? ""));
}

function comparison(item: any): { key: string; explicit: boolean; clean: boolean } | null {
	if (item?.type !== "album" && item?.type !== "track") return null;
	const album = item?.collection?.albumAPI ?? item?.single?.albumAPI ?? item?.single?.trackAPI?.album;
	const tracks = item?.collection?.tracks ??
		(item?.single?.trackAPI ? [item.single.trackAPI] : []);
	if (!album || !Array.isArray(tracks) || !tracks.length) return null;
	const title = normalizedEditionTitle(album.title ?? item.title);
	const artist = normalizeReleaseTitle(album.artist?.name ?? item.artist ?? "");
	const trackTitles = tracks.map((track: any) => normalizedEditionTitle(track?.title ?? track?.SNG_TITLE));
	if (!title || !artist || trackTitles.some((trackTitle: string) => !trackTitle)) return null;
	const explicit = isExplicit(item) || isExplicit(album) || tracks.some(isExplicit);
	const clean = !explicit && (
		isKnownClean(item) || isKnownClean(album) || tracks.some(isKnownClean)
	);
	return {
		key: JSON.stringify([artist, title, trackTitles]),
		explicit,
		clean,
	};
}

export function skipCleanWhenExplicitAvailable<T>(items: T[]): T[] {
	const editions = items.map(comparison);
	const explicitKeys = new Set(
		editions.filter((edition) => edition?.explicit).map((edition) => edition!.key)
	);
	return items.filter((_, index) => {
		const edition = editions[index];
		return !edition || !edition.clean || !explicitKeys.has(edition.key);
	});
}
