import type { Deezer } from "deezer-sdk";
import type { Collection, Convertable } from "../download-objects/Collection.js";
import type { Listener } from "../types/listener.js";
import type { Settings } from "../types/Settings.js";
import BasePlugin from "./base.js";

export interface ConvertiblePlugin extends BasePlugin {
	convert(
		dz: Deezer,
		downloadObject: Convertable,
		settings: Settings,
		listener?: Listener | null
	): Promise<Collection>;
}

export type PluginRegistry = Record<string, BasePlugin>;

export function isConvertiblePlugin(
	plugin: BasePlugin | undefined
): plugin is ConvertiblePlugin {
	return (
		plugin !== undefined &&
		"convert" in plugin &&
		typeof (plugin as { convert?: unknown }).convert === "function"
	);
}
