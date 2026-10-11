import { describe, expect, it, vi } from "vitest";
import { DeemixApp } from "./deemixApp.js";

describe("clearErroredDownloads", () => {
	it("only removes terminal errored queue records and preserves other states", () => {
		// Bypass network-dependent plugin initialization; exercise the actual
		// queue method with explicit records and persistence spies.
		const app = Object.create(DeemixApp.prototype) as DeemixApp;
		app.queue = {
			failed: { uuid: "failed", status: "failed" },
			partial: { uuid: "partial", status: "withErrors" },
			queued: { uuid: "queued", status: "inQueue" },
			active: { uuid: "active", status: "downloading" },
			stopped: { uuid: "stopped", status: "stopped" },
			complete: { uuid: "complete", status: "completed" },
		};
		app.queueOrder = ["queued", "failed", "active"];
		const removedFile = vi.spyOn(app as any, "removeQueueFile").mockImplementation(() => {});
		const wroteOrder = vi.spyOn(app as any, "persistQueueOrder").mockImplementation(() => {});
		const send = vi.fn();
		app.listener = { send } as any;

		expect(app.clearErroredDownloads()).toBe(2);
		expect(Object.keys(app.queue)).toEqual(["queued", "active", "stopped", "complete"]);
		expect(app.queueOrder).toEqual(["queued", "active"]);
		expect(removedFile.mock.calls.map(([uuid]) => uuid)).toEqual(["failed", "partial"]);
		expect(wroteOrder).toHaveBeenCalledOnce();
		expect(send).toHaveBeenCalledWith("removedErroredDownloads", {
			uuids: ["failed", "partial"],
		});
	});

	it("does not mutate pending queue order when no failures exist", () => {
		const app = Object.create(DeemixApp.prototype) as DeemixApp;
		app.queue = { one: { uuid: "one", status: "completed" } };
		app.queueOrder = ["next"];
		const remove = vi.spyOn(app as any, "removeQueueFile").mockImplementation(() => {});
		const write = vi.spyOn(app as any, "persistQueueOrder").mockImplementation(() => {});
		app.listener = { send: vi.fn() } as any;
		expect(app.clearErroredDownloads()).toBe(0);
		expect(remove).not.toHaveBeenCalled();
		expect(write).not.toHaveBeenCalled();
		expect(app.queueOrder).toEqual(["next"]);
	});
});
