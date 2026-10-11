import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeISRC, resolveISRCTrackID } from "./isrcCache.js";

describe("ISRC fallback cache helpers", () => {
	it("normalizes formatted ISRCs", () => {
		expect(normalizeISRC("FR-8FB-19-01330")).toBe("FR8FB1901330");
		expect(normalizeISRC(" fr8fb1901330 ")).toBe("FR8FB1901330");
	});
});

afterEach(() => vi.useRealTimers());

describe("ISRC resolution timeout", () => {
	it("does not pin lookup cache forever on a hung Deezer API request", async () => {
		vi.useFakeTimers();
		const lookup = vi.fn(() => new Promise<any>(() => {}));
		const dz = { api: { getTrack: lookup } } as any;
		const pending = resolveISRCTrackID(dz, "USZZ99999991");
		const result = expect(pending).resolves.toBeNull();
		await vi.advanceTimersByTimeAsync(5001);
		await result;
		const again = resolveISRCTrackID(dz, "USZZ99999991");
		const resultAgain = expect(again).resolves.toBeNull();
		await vi.advanceTimersByTimeAsync(5001);
		await resultAgain;
		expect(lookup).toHaveBeenCalledTimes(2);
	});
});
