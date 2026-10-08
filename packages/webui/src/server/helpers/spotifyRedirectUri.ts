import type { Request } from "express";

/** Use a configured origin for reverse-proxy deployments, never untrusted forwarded headers. */
export function spotifyRedirectUri(req: Request): string {
	const configured = process.env.DEEMIX_PUBLIC_URL?.trim();
	if (configured) {
		const base = new URL(configured);
		if (base.protocol !== "https:" && base.protocol !== "http:") {
			throw new Error("DEEMIX_PUBLIC_URL must be an HTTP(S) origin.");
		}
		if (base.username || base.password || base.search || base.hash)
			throw new Error("DEEMIX_PUBLIC_URL must contain only an origin.");
		return new URL("/api/spotifyCallback", base.origin).href;
	}
	const host = req.headers.host;
	if (!host || /[\\\s/]/.test(host)) throw new Error("Missing or invalid HTTP host.");
	return new URL("/api/spotifyCallback", `${req.protocol}://${host}`).href;
}
