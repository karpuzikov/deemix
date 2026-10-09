import { describe, expect, it } from "vitest";
import {
	getReleaseEditionKey,
	getReleaseFamilyTitle,
	isMainArtistDownloadObject,
	isMainArtistRelease,
	isReleaseVariantTitle,
	isSameReleaseArtist,
	shouldExpandArtistDiscography,
	skipCleanWhenExplicitAvailable,
} from "./releaseVariants.js";

describe("release variant helpers", () => {
	it("groups bracketed editions into one release family", () => {
		expect(getReleaseFamilyTitle("Ceinture noire (Décennie)")).toBe(
			"Ceinture noire"
		);
		expect(
			isReleaseVariantTitle("Ceinture noire", "Ceinture noire (Décennie)")
		).toBe(true);
	});

	it("does not group unrelated similarly prefixed titles", () => {
		expect(isReleaseVariantTitle("Ceinture noire", "Ceinture noire 2")).toBe(
			false
		);
	});

	it("matches artists by Deezer id before name", () => {
		expect(
			isSameReleaseArtist(
				{ id: 123, name: "GIMS" },
				{ id: 123, name: "Maître Gims" }
			)
		).toBe(true);
	});

	it("keeps releases where the selected artist is an album-level main artist", () => {
		const rootArtist = { id: 123, name: "INNA" };

		expect(
			isMainArtistRelease(rootArtist, {
				artist: { id: 123, name: "INNA" },
			})
		).toBe(true);

		expect(
			isMainArtistRelease(rootArtist, {
				artist: { id: 999, name: "Collaborator" },
				contributors: [
					{ id: 999, name: "Collaborator", role: "Main" },
					{ id: 123, name: "INNA", role: "Main" },
				],
			})
		).toBe(true);
	});

	it("excludes featured appearances and Various Artists compilations", () => {
		const rootArtist = { id: 123, name: "INNA" };

		expect(
			isMainArtistRelease(rootArtist, {
				artist: { id: 999, name: "Another Artist" },
				contributors: [{ id: 123, name: "INNA", role: "Featured" }],
			})
		).toBe(false);

		expect(
			isMainArtistDownloadObject(rootArtist, {
				collection: {
					albumAPI: {
						artist: { id: 5080, name: "Various Artists" },
						contributors: [],
					},
					tracks: [{ artist: { id: 123, name: "INNA" } }],
				},
			})
		).toBe(false);
	});

	it("treats a plain artist link as exhaustive discography mode", () => {
		expect(shouldExpandArtistDiscography("all")).toBe(true);
		expect(shouldExpandArtistDiscography("discography")).toBe(true);
		expect(shouldExpandArtistDiscography("album")).toBe(false);
	});

	it("keeps different barcodes as different release editions", () => {
		const a = { collection: { albumAPI: { upc: "3610154144078" } } };
		const b = { collection: { albumAPI: { upc: "3610154144085" } } };
		expect(getReleaseEditionKey(a)).not.toBe(getReleaseEditionKey(b));
	});

	it("uses alternate barcode field names", () => {
		const a = { collection: { albumAPI: { barcode: "3610154144078" } } };
		const b = { collection: { albumAPI: { UPC: "3610154144078" } } };
		expect(getReleaseEditionKey(a)).toBe(getReleaseEditionKey(b));
	});

	it("deduplicates equivalent UPC formatting", () => {
		const a = { collection: { albumAPI: { upc: "0842812155857" } } };
		const b = { collection: { albumAPI: { upc: "842812155857" } } };
		expect(getReleaseEditionKey(a)).toBe(getReleaseEditionKey(b));
	});

	it("falls back to track ISRCs when no barcode exists", () => {
		const item = {
			collection: {
				albumAPI: {},
				tracks: [{ isrc: "FR-ABC-12-34567" }, { isrc: "USXYZ1234567" }],
			},
		};
		expect(getReleaseEditionKey(item)).toContain(
			"tracks:isrc:FRABC1234567|isrc:USXYZ1234567"
		);
	});
});

describe("skip clean albums when matching explicit albums exist", () => {
	const album = (id: number, explicit: boolean, options: {
		title?: string; artist?: string; tracks?: string[]; known?: boolean; type?: string
	} = {}) => ({
		id: String(id),
		type: options.type ?? "album",
		artist: options.artist ?? "Artist",
		explicit: options.known === false ? undefined : explicit,
		collection: {
			albumAPI: {
				title: options.title ?? "Album",
				artist: { name: options.artist ?? "Artist" },
				explicit_lyrics: options.known === false ? undefined : explicit,
				upc: String(id),
			},
			tracks: (options.tracks ?? ["Opening", "Song"]).map((title, i) => ({
				title, position: i + 1,
				explicit_lyrics: options.known === false ? undefined : explicit,
			})),
		},
	});

	it("removes clean counterparts with different UPCs in either order", () => {
		const clean = album(1, false), explicit = album(2, true);
		expect(skipCleanWhenExplicitAvailable([clean, explicit])).toEqual([explicit]);
		expect(skipCleanWhenExplicitAvailable([explicit, clean])).toEqual([explicit]);
	});
	it("keeps clean-only and unknown-status releases", () => {
		const clean = album(1, false), unknown = album(3, false, { known: false });
		expect(skipCleanWhenExplicitAvailable([clean])).toEqual([clean]);
		expect(skipCleanWhenExplicitAvailable([unknown, album(2, true)])).toHaveLength(2);
	});
	it("does not collapse deluxe tracklists, different tracks, artists, or named editions", () => {
		const clean = album(1, false);
		const variants = [
			album(2, true, { tracks: ["Opening", "Song", "Bonus"] }),
			album(3, true, { tracks: ["Opening", "Remix"] }),
			album(4, true, { artist: "Other Artist" }),
			album(5, true, { title: "Album (Live)" }),
		];
		expect(skipCleanWhenExplicitAvailable([clean, ...variants])).toHaveLength(5);
	});
	it("recognizes only clean/explicit suffixes on album and track titles", () => {
		const clean = album(1, false, { title: "Album (Clean)", tracks: ["Song (Clean)"] });
		const explicit = album(2, true, { title: "Album (Explicit)", tracks: ["Song (Explicit)"] });
		expect(skipCleanWhenExplicitAvailable([clean, explicit])).toEqual([explicit]);
	});
	it("never filters a user playlist", () => {
		const playlist = album(1, false, { type: "playlist" });
		expect(skipCleanWhenExplicitAvailable([playlist, album(2, true)])).toHaveLength(2);
	});
});
