import { describe, expect, it } from "vitest";
import {
	DEFAULT_MAX_RETRIES,
	getRetryDelay,
	getRetryDelayForError,
	isRetryableHTTPError,
	isTransientNetworkError,
} from "./retry.js";

describe("retry helpers", () => {
	it("recognizes transient network errors", () => {
		expect(isTransientNetworkError({ code: "ETIMEDOUT" })).toBe(true);
		expect(isTransientNetworkError({ code: "ECONNRESET" })).toBe(true);
		expect(isTransientNetworkError({ code: "ENOENT" })).toBe(false);
		expect(isTransientNetworkError(null)).toBe(false);
	});

	it("recognizes retryable HTTP statuses", () => {
		expect(isRetryableHTTPError({ response: { statusCode: 429 } })).toBe(true);
		expect(isRetryableHTTPError({ response: { statusCode: 503 } })).toBe(true);
		expect(isRetryableHTTPError({ response: { statusCode: 404 } })).toBe(false);
	});

	it("uses bounded exponential backoff", () => {
		expect(DEFAULT_MAX_RETRIES).toBe(3);
		expect(getRetryDelay(0)).toBe(1000);
		expect(getRetryDelay(1)).toBe(2000);
		expect(getRetryDelay(2)).toBe(4000);
		expect(getRetryDelay(-1)).toBe(1000);
	});

	it("respects Retry-After", () => {
		expect(
			getRetryDelayForError(
				{ response: { headers: { "retry-after": "3" } } },
				0
			)
		).toBe(3000);
	});
});
