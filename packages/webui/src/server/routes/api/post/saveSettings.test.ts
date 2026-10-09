import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import saveSettings from "./saveSettings.js";
import getSettings from "../get/getSettings.js";

describe("skip-clean setting persisted by the HTTP API", () => {
	it("updates the actual settings object and reads it back", async () => {
		let current: any = { tags: {}, skipCleanIfExplicitAvailable: false };
		const deemix = {
			getSettings: () => ({ settings: current }),
			saveSettings: vi.fn((settings: any) => { current = settings; }),
			listener: { send: vi.fn() },
		};
		const app = express();
		app.use(express.json());
		app.set("deemix", deemix);
		app.post("/api/saveSettings", saveSettings.handler);
		app.get("/api/getSettings", getSettings.handler);

		const result = await request(app).post("/api/saveSettings").send({
			settings: { tags: {}, skipCleanIfExplicitAvailable: true },
			spotifySettings: {},
		});
		expect(result.status).toBe(200);
		expect(result.body.result).toBe(true);
		expect(deemix.saveSettings).toHaveBeenCalledOnce();
		const persisted = await request(app).get("/api/getSettings");
		expect(persisted.body.settings.skipCleanIfExplicitAvailable).toBe(true);
	});
});
