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
