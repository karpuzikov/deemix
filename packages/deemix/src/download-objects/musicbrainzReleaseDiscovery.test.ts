import { describe, expect, it } from "vitest";
import {
	collectMusicBrainzBarcodes,
	getMusicBrainzArtistId,
} from "./musicbrainzReleaseDiscovery.js";

describe("MusicBrainz hidden release discovery helpers", () => {
	it("extracts the artist MBID from an exact Deezer URL lookup", () => {
		expect(
			getMusicBrainzArtistId({
				relations: [
					{
						"target-type": "artist",
						artist: {
							id: "99efca32-eea1-45fb-92cb-8798976a9769",
							name: "INNA",
						},
					},
				],
			})
		).toBe("99efca32-eea1-45fb-92cb-8798976a9769");
	});

	it("keeps unique official barcodes and ignores placeholders", () => {
		expect(
			collectMusicBrainzBarcodes([
				{ barcode: "5948204052898", status: "Official" },
				{ barcode: "5948204052898", status: "Official" },
				{ barcode: "0000000000000", status: "Official" },
				{ barcode: null, status: "Official" },
				{ barcode: "3616844494171", status: "Official" },
				{ barcode: "12345678", status: "Bootleg" },
			])
		).toEqual(["5948204052898", "3616844494171"]);
	});
});
