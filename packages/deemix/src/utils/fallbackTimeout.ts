/**
 * Limit auxiliary Deezer metadata work, not streaming of audio data.
 * The losing promise is observed by Promise.race and can settle later.
 */
export async function withFallbackTimeout<T>(
	operation: () => Promise<T>,
	deadlineMs: number,
	requestTimeoutMs = 5000
): Promise<T> {
	const remaining = Math.min(requestTimeoutMs, deadlineMs - Date.now());
	if (remaining <= 0) throw new Error("Fallback deadline exceeded");
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			Promise.resolve().then(operation),
			new Promise<T>((_, reject) => {
				timer = setTimeout(() => reject(new Error("Fallback lookup timed out")), remaining);
			}),
		]);
	} finally {
		if (timer !== undefined) clearTimeout(timer);
	}
}
