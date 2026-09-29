import { describe, expect, it } from "vitest";
import { normalizeMusicBrainzText } from "./musicbrainzFallback.js";

describe("MusicBrainz metadata fallback helpers", () => {
	it("normalizes accents and punctuation", () => {
		expect(normalizeMusicBrainzText("Ceinture noire (Décennie)")).toBe(
			"ceinture noire decennie"
		);
	});
});
