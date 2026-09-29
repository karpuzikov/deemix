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
