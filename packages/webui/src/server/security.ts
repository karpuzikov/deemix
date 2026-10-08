import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingHttpHeaders, IncomingMessage } from "node:http";

const cookieName = "deemix_remote_auth";
const cookieKey = randomBytes(32);
const cookieLifetimeMs = 8 * 60 * 60 * 1000;

export function isLoopbackHost(host: string): boolean {
	return ["127.0.0.1", "::1", "[::1]", "localhost"].includes(host.trim().toLowerCase());
}

export function isAllowedOrigin(headers: IncomingHttpHeaders): boolean {
	if (headers["sec-fetch-site"] === "cross-site") return false;
	const origin = headers.origin;
	if (!origin) return true;
	if (typeof origin !== "string" || !headers.host) return false;
	try {
		const parsed = new URL(origin);
		return (parsed.protocol === "http:" || parsed.protocol === "https:") &&
			parsed.host.toLowerCase() === headers.host.toLowerCase();
	} catch {
		return false;
	}
}

export function isAllowedLocalHost(headers: IncomingHttpHeaders): boolean {
	const host = String(headers.host ?? "").toLowerCase();
	return /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host);
}

function equals(a: string, b: string): boolean {
	const lhs = Buffer.from(a);
	const rhs = Buffer.from(b);
	return lhs.length === rhs.length && timingSafeEqual(lhs, rhs);
}

export function createRemoteAccess(secret: string) {
	if (secret.length < 24) throw new Error(
		"DEEMIX_ACCESS_TOKEN must contain at least 24 characters for non-loopback access."
	);
	const cookieValue = createHmac("sha256", cookieKey).update(secret).digest("hex");

	function isAuthorized(request: Pick<IncomingMessage, "headers">): boolean {
		const cookies = String(request.headers.cookie ?? "").split(";").map((entry) => entry.trim());
		const cookie = cookies.find((entry) => entry.startsWith(cookieName + "="));
		if (cookie && equals(cookie.slice(cookieName.length + 1), cookieValue)) return true;
		const authorization = request.headers.authorization;
		if (!authorization?.startsWith("Basic ")) return false;
		try {
			const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
			const separator = decoded.indexOf(":");
			return separator !== -1 && decoded.slice(0, separator) === "deemix" &&
				equals(decoded.slice(separator + 1), secret);
		} catch {
			return false;
		}
	}
	return { isAuthorized, cookieName, cookieValue, cookieLifetimeMs };
}
