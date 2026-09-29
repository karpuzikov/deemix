import { describe, expect, it } from "vitest";
import {
	getReleaseEditionKey,
	getReleaseFamilyTitle,
	isReleaseVariantTitle,
	isSameReleaseArtist,
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
