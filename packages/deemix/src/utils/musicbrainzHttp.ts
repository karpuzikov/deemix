import got from "got";

const minimumIntervalMs = 1100;
let requestChain: Promise<void> = Promise.resolve();
let nextRequestAt = 0;

export function musicBrainzRetryDelayMs(retryAfter: string | string[] | undefined, now = Date.now()): number {
	const header = Array.isArray(retryAfter) ? retryAfter[0] : retryAfter;
	if (!header) return 5000;
	const seconds = Number(header);
	if (header.trim() !== "" && Number.isFinite(seconds) && seconds >= 0) {
		return seconds * 1000;
	}
	const date = Date.parse(header);
	return Number.isFinite(date) ? Math.max(0, date - now) : 5000;
}

/**
 * Shared MusicBrainz transport. Serializes API requests across metadata and
 * release discovery; HTTP 503 always retries, honoring Retry-After.
 */
export async function musicBrainzJSON<T>(
	endpoint: string,
	searchParams: Record<string, string | number>,
	userAgent = "deemix-karpuzikov/3.14.0 (https://github.com/karpuzikov/deemix)"
): Promise<T> {
	const work = requestChain.then(async (): Promise<T> => {
		for (;;) {
			const delay = Math.max(0, nextRequestAt - Date.now());
			if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
			nextRequestAt = Date.now() + minimumIntervalMs;
			try {
				return await got.get(`https://musicbrainz.org/ws/2/${endpoint}`, {
					searchParams,
					headers: { "User-Agent": userAgent },
					timeout: { request: 20000 },
					retry: { limit: 2 },
				}).json<T>();
			} catch (error) {
				const response = (error as { response?: { statusCode?: number; headers?: { "retry-after"?: string | string[] } } }).response;
				if (response?.statusCode !== 503) throw error;
				await new Promise((resolve) => setTimeout(resolve, musicBrainzRetryDelayMs(response.headers?.["retry-after"])));
			}
		}
	});
	requestChain = work.then(() => undefined, () => undefined);
	return work;
}
