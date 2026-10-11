import { afterEach, describe, expect, it, vi } from "vitest";
import { withFallbackTimeout } from "./fallbackTimeout.js";

afterEach(() => vi.useRealTimers());

describe("fallback metadata deadline", () => {
	it("returns results without delay", async () => {
		expect(await withFallbackTimeout(async () => 42, Date.now() + 10000)).toBe(42);
	});
	it("does not hang on an unresolved request", async () => {
		vi.useFakeTimers();
		const result = withFallbackTimeout(
			() => new Promise<number>(() => {}),
			Date.now() + 300,
			5000
		);
		const assertion = expect(result).rejects.toThrow("timed out");
		await vi.advanceTimersByTimeAsync(301);
		await assertion;
	});
	it("does not launch requests past the deadline", async () => {
		const fn = vi.fn(async () => 12);
		await expect(withFallbackTimeout(fn, Date.now() - 1)).rejects.toThrow("deadline exceeded");
		expect(fn).not.toHaveBeenCalled();
	});
	it("ignores a response that arrives after deadline", async () => {
		vi.useFakeTimers();
		let finish: (value: string) => void = () => {};
		const result = withFallbackTimeout(
			() => new Promise<string>(resolve => { finish = resolve; }),
			Date.now() + 100
		);
		const assertion = expect(result).rejects.toThrow("timed out");
		await vi.advanceTimersByTimeAsync(100);
		await assertion;
		finish("too late");
		await vi.runAllTimersAsync();
	});
});
