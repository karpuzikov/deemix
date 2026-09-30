import { describe, expect, it } from "vitest";
import {
	getReleaseEditionKey,
	getReleaseFamilyTitle,
	isMainArtistDownloadObject,
	isReleaseVariantTitle,
	isSameReleaseArtist,
	shouldExpandArtistDiscography,
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

	it("keeps only releases where the selected artist is the album main artist", () => {
		const rootArtist = { id: 123, name: "INNA" };

		expect(
			isMainArtistDownloadObject(rootArtist, {
				collection: {
					albumAPI: { artist: { id: 123, name: "INNA" } },
				},
			})
		).toBe(true);

		expect(
			isMainArtistDownloadObject(rootArtist, {
				collection: {
					albumAPI: { artist: { id: 5080, name: "Various Artists" } },
					tracks: [{ artist: { id: 123, name: "INNA" } }],
				},
			})
		).toBe(false);

		expect(
			isMainArtistDownloadObject(rootArtist, {
				collection: {
					albumAPI: { artist: { id: 999, name: "Another Artist" } },
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
