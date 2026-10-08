import { describe, it, expect } from "vitest";
import { musicBrainzRetryDelayMs } from "./musicbrainzHttp.js";
describe("MusicBrainz HTTP 503 retry delay", () => {
	it("defaults to five seconds and parses Retry-After seconds", () => {
		expect(musicBrainzRetryDelayMs(undefined)).toBe(5000);
		expect(musicBrainzRetryDelayMs("7")).toBe(7000);
		expect(musicBrainzRetryDelayMs("invalid")).toBe(5000);
	});
	it("supports HTTP date retry headers", () => {
		expect(musicBrainzRetryDelayMs("Thu, 08 Oct 2026 10:00:05 GMT", Date.parse("2026-10-08T10:00:00Z"))).toBe(5000);
	});
});
