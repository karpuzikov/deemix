const TRANSIENT_NETWORK_ERROR_CODES = new Set([
	"ECONNABORTED",
	"ECONNREFUSED",
	"ECONNRESET",
	"ENETRESET",
	"ETIMEDOUT",
]);

export const DEFAULT_MAX_RETRIES = 3;

export function isTransientNetworkError(error: unknown): boolean {
	if (!error || typeof error !== "object" || !("code" in error)) return false;
	const code = (error as { code?: unknown }).code;
	return typeof code === "string" && TRANSIENT_NETWORK_ERROR_CODES.has(code);
}

export function getRetryDelay(attempt: number, baseDelayMs = 1000): number {
	const safeAttempt = Math.max(0, Math.floor(attempt));
	return baseDelayMs * 2 ** safeAttempt;
}

export function getHTTPStatus(error: unknown): number | null {
	if (!error || typeof error !== "object") return null;
	const response = (error as { response?: { statusCode?: unknown } }).response;
	return typeof response?.statusCode === "number" ? response.statusCode : null;
}

export function isRetryableHTTPError(error: unknown): boolean {
	const status = getHTTPStatus(error);
	return status === 408 || status === 429 || (status !== null && status >= 500);
}

export function getRetryDelayForError(
	error: unknown,
	attempt: number,
	baseDelayMs = 1000
): number {
	if (error && typeof error === "object") {
		const headers = (
			error as { response?: { headers?: Record<string, string | string[] | undefined> } }
		).response?.headers;
		const retryAfter = headers?.["retry-after"];
		const raw = Array.isArray(retryAfter) ? retryAfter[0] : retryAfter;
		if (raw) {
			const seconds = Number(raw);
			if (Number.isFinite(seconds) && seconds >= 0) {
				return Math.max(250, Math.round(seconds * 1000));
			}
		}
	}
	return getRetryDelay(attempt, baseDelayMs);
}
