import { sessionDZ } from "@/deemixApp.js";
import connect from "../get/connect.js";
import logout from "./logout.js";
import express from "express";
import session from "express-session";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import loginArl from "./loginArl.js";
import addToQueue from "./addToQueue.js";

vi.mock("@/deemixApp.js", () => ({ sessionDZ: {} }));
const savedLogin = vi.hoisted(() => ({ arl: null as string | null }));

vi.mock("@/helpers/loginStorage.js", () => ({
	getLoginCredentials: vi.fn(() => ({ arl: savedLogin.arl })),
	resetLoginCredentials: vi.fn(() => { savedLogin.arl = null; }),
	saveLoginCredentials: vi.fn((login: { arl: string | null }) => {
		savedLogin.arl = login.arl;
	}),
}));
vi.mock("@/helpers/logger.js", () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("deezer-sdk", () => ({
	Deezer: class {
		loggedIn = false;
		currentUser = { id: 123, name: "Test", can_stream_hq: true, can_stream_lossless: true };
		childs = [];
		selectedAccount = 0;
		async loginViaArl(arl: string) {
			this.loggedIn = arl === "abcdef1234";
			return this.loggedIn;
		}
	},
}));

describe("login session persists through download requests", () => {
	beforeEach(() => {
		savedLogin.arl = null;
		for (const key of Object.keys(sessionDZ)) delete sessionDZ[key];
		// Use the normal login code path; the older NODE_ENV=test branch logs
		// in a temporary Deezer instance and cannot test session continuity.
		vi.stubEnv("NODE_ENV", "production");
	});
	afterEach(() => vi.unstubAllEnvs());

	function createApp(singleUser = false) {
		const app = express();
		app.use(express.json());
		app.use(
			// @ts-expect-error express-session provides a callable CommonJS export at runtime.
			session({
			secret: "test-session-cookie-secret",
			resave: false,
			saveUninitialized: false,
			cookie: { httpOnly: true, sameSite: "strict" },
		}));
		app.set("isSingleUser", singleUser);
		app.set("deemix", {
			isDeezerAvailable: async () => true,
			startQueue: vi.fn(),
			getSettings: () => ({ settings: { maxBitrate: 3, autoCheckForUpdates: false } }),
			getQueue: () => ({ queue: {}, queueOrder: [] }),
			plugins: { spotify: { enabled: false } },
			addToQueue: async (dz: { loggedIn: boolean }) => {
				if (!dz.loggedIn) {
					const error = new Error("Login required");
					error.name = "NotLoggedIn";
					throw error;
				}
				return [{ uuid: "test-queue-item" }];
			},
			listener: { send: vi.fn() },
		});
		app.get("/api/connect", connect.handler);
		app.post("/api/logout", logout.handler);
		app.post("/api/loginArl", loginArl.handler);
		app.post("/api/addToQueue", addToQueue.handler);
		return app;
	}

	it("issues a session cookie and reuses authenticated Deezer for a subsequent download", async () => {
		const app = createApp();
		const agent = request.agent(app);
		const payload = { url: "https://www.deezer.com/track/123", bitrate: 3 };

		const unauthenticated = await agent.post("/api/addToQueue").send(payload);
		expect(unauthenticated.body.result).toBe(false);
		expect(unauthenticated.body.errid).toBe("NotLoggedIn");

		const login = await agent.post("/api/loginArl").send({ arl: "abcdef1234" });
		expect(login.status).toBe(200);
		expect(login.body.status).toBe(1);
		expect(login.headers["set-cookie"]).toBeDefined();

		const download = await agent.post("/api/addToQueue").send(payload);
		expect(download.status).toBe(200);
		expect(download.body.result).toBe(true);
		expect(download.body.data.obj).toEqual([{ uuid: "test-queue-item" }]);

		// The login remains isolated to the browser that received the cookie.
		const anotherBrowser = await request(app).post("/api/addToQueue").send(payload);
		expect(anotherBrowser.body.errid).toBe("NotLoggedIn");
	});

	it("restores a locally saved login after a complete desktop restart", async () => {
		const first = request.agent(createApp(true));
		const loggedIn = await first.post("/api/loginArl").send({ arl: "abcdef1234" });
		expect(loggedIn.body.status).toBe(1);
		expect(savedLogin.arl).toBe("abcdef1234");

		// The old browser and Express session are gone; durable credentials
		// (mocked at the storage boundary) survive the restart.
		for (const key of Object.keys(sessionDZ)) delete sessionDZ[key];
		const restarted = request.agent(createApp(true));
		const connected = await restarted.get("/api/connect");
		expect(connected.status).toBe(200);
		expect(connected.body.autologin).toBe(true);
		expect(connected.body.singleUser.arl).toBe("abcdef1234");
		const restored = await restarted.post("/api/loginArl").send({
			arl: connected.body.singleUser.arl,
		});
		expect(restored.body.status).toBe(1);
		const download = await restarted.post("/api/addToQueue").send({
			url: "https://www.deezer.com/track/123",
			bitrate: 3,
		});
		expect(download.body.result).toBe(true);

		await restarted.post("/api/logout");
		expect(savedLogin.arl).toBeNull();
		const afterLogout = await request(createApp(true)).get("/api/connect");
		expect(afterLogout.body.singleUser.arl).toBeNull();
	});

	it("never persists browser-only login credentials in multi-user mode", async () => {
		const browser = request.agent(createApp(false));
		const result = await browser.post("/api/loginArl").send({ arl: "abcdef1234" });
		expect(result.body.status).toBe(1);
		expect(savedLogin.arl).toBeNull();
	});

	it("does not persist an uninitialized or failed login session", async () => {
		const app = createApp();
		const agent = request.agent(app);
		const failed = await agent.post("/api/loginArl").send({ arl: "bad00" });
		expect(failed.body.status).toBe(0);
		expect(failed.headers["set-cookie"]).toBeUndefined();
	});
});
