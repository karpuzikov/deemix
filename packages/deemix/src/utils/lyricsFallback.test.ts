import { describe, expect, it } from "vitest";
import { normalizeLyricsLookupText } from "./lyricsFallback.js";

describe("LRCLIB lookup helpers", () => {
	it("normalizes accents and punctuation", () => {
		expect(normalizeLyricsLookupText("L'odyssée")).toBe("l odyssee");
	});
});
