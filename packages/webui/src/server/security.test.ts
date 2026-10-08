import { describe, it, expect } from "vitest";
import { createRemoteAccess, isAllowedLocalHost, isAllowedOrigin, isLoopbackHost } from "./security.js";

describe("remote access boundary", () => {
	it("defaults to loopback host and rejects DNS rebinding host values", () => {
		expect(isLoopbackHost("127.0.0.1")).toBe(true);
		expect(isLoopbackHost("0.0.0.0")).toBe(false);
		expect(isAllowedLocalHost({ host: "127.0.0.1:6595" })).toBe(true);
		expect(isAllowedLocalHost({ host: "evil.test:6595" })).toBe(false);
	});
	it("blocks cross-origin API and WebSocket requests", () => {
		expect(isAllowedOrigin({ host: "127.0.0.1:6595", origin: "https://evil.test" })).toBe(false);
		expect(isAllowedOrigin({ host: "127.0.0.1:6595", origin: "http://127.0.0.1:6595" })).toBe(true);
		expect(isAllowedOrigin({ host: "127.0.0.1:6595", "sec-fetch-site": "cross-site" })).toBe(false);
	});
	it("requires a long token and accepts Basic or an issued browser cookie", () => {
		expect(() => createRemoteAccess("weak")).toThrow();
		const access = createRemoteAccess("my_secure_secret_0123456789_abcdefghijkl");
		expect(access.isAuthorized({ headers: {} })).toBe(false);
		expect(access.isAuthorized({ headers: { authorization: "Basic " + Buffer.from("deemix:wrong").toString("base64") } })).toBe(false);
		expect(access.isAuthorized({ headers: { authorization: "Basic " + Buffer.from("deemix:my_secure_secret_0123456789_abcdefghijkl").toString("base64") } })).toBe(true);
		expect(access.isAuthorized({ headers: { cookie: access.cookieName + "=" + access.cookieValue } })).toBe(true);
	});
});
