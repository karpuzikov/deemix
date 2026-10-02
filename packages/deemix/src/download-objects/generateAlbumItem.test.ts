import { describe, expect, it } from "vitest";
import { mergeExactReleaseMetadata } from "./generateAlbumItem.js";

describe("exact release metadata", () => {
	it("keeps exact Deezer page identity when public API points at a fallback release", () => {
		const result = mergeExactReleaseMetadata(
			{
				id: 999,
				title: "Hey Sunshine (Antonio Giacca Remix)",
				artist: { id: 999, name: "Sugarstarr" },
				contributors: [
					{ id: 999, name: "Sugarstarr", role: "Main" },
					{ id: 998, name: "Alexander", role: "Main" },
				],
				upc: "7640130678576",
				genres: { data: [{ name: "House" }] },
			},
			{
				id: 13341881,
				title: "Heaven",
				artist: { id: 123, name: "INNA" },
				contributors: [{ id: 123, name: "INNA", role: "Main" }],
				upc: "correct-barcode",
			},
			"13341881"
		);

		expect(result.id).toBe(13341881);
		expect(result.title).toBe("Heaven");
		expect(result.artist.name).toBe("INNA");
		expect(result.contributors.map((artist: any) => artist.name)).toEqual([
			"INNA",
		]);
		expect(result.upc).toBe("correct-barcode");
		expect(result.genres.data[0].name).toBe("House");
	});
});
