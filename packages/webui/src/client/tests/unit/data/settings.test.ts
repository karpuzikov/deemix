import { describe, expect, it, vi } from "vitest";
import { persistSettings } from "@/data/settings";
import { postToServer } from "@/utils/api-utils";

vi.mock("@/utils/api-utils", () => ({
	fetchData: vi.fn(),
	postToServer: vi.fn(),
}));

describe("persistSettings", () => {
	it("saves skip-clean preference over acknowledged HTTP", async () => {
		vi.mocked(postToServer).mockResolvedValueOnce({ result: true });
		await persistSettings(
			{ tags: {}, skipCleanIfExplicitAvailable: true },
			{ clientId: "", clientSecret: "", fallbackSearch: false }
		);
		expect(postToServer).toHaveBeenCalledWith("saveSettings", {
			settings: { tags: {}, skipCleanIfExplicitAvailable: true },
			spotifySettings: { clientId: "", clientSecret: "", fallbackSearch: false },
		});
	});
	it("rejects silent network failures and missing acknowledgements", async () => {
		vi.mocked(postToServer).mockResolvedValueOnce(undefined);
		await expect(persistSettings({ tags: {} }, {})).rejects.toThrow("not saved");
		vi.mocked(postToServer).mockResolvedValueOnce({ result: false });
		await expect(persistSettings({ tags: {} }, {})).rejects.toThrow("not saved");
	});
});
