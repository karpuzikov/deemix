import { describe, expect, it } from "vitest";
import { normalizeISRC } from "./isrcCache.js";

describe("ISRC fallback cache helpers", () => {
	it("normalizes formatted ISRCs", () => {
		expect(normalizeISRC("FR-8FB-19-01330")).toBe("FR8FB1901330");
		expect(normalizeISRC(" fr8fb1901330 ")).toBe("FR8FB1901330");
	});
});
