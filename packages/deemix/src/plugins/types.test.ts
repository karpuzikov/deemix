import { describe, expect, it } from "vitest";
import BasePlugin from "./base.js";
import { isConvertiblePlugin } from "./types.js";

describe("plugin type guards", () => {
	it("rejects plugins without conversion support", () => {
		expect(isConvertiblePlugin(undefined)).toBe(false);
		expect(isConvertiblePlugin(new BasePlugin())).toBe(false);
	});

	it("accepts plugins that implement convert", () => {
		const plugin = Object.assign(new BasePlugin(), {
			convert: async () => null,
		});
		expect(isConvertiblePlugin(plugin)).toBe(true);
	});
});
