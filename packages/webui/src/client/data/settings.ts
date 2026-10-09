import { fetchData, postToServer } from "@/utils/api-utils";

let settingsData = {};
let defaultSettingsData = {};
let spotifyCredentials: any = {};

export async function getSettingsData() {
	const data = await fetchData("getSettings");
	const { settings, defaultSettings, spotifySettings } = data;

	settingsData = settings;
	defaultSettingsData = defaultSettings;
	spotifyCredentials = spotifySettings || {};

	return { settingsData, defaultSettingsData, spotifyCredentials };
}

export function getInitialPreviewVolume() {
	let volume = parseInt(localStorage.getItem("previewVolume") ?? "");

	if (isNaN(volume)) {
		volume = 80; // Default
		localStorage.setItem("previewVolume", volume.toString());
	}

	return volume;
}

/** Save through HTTP with an acknowledged response, unlike fire-and-forget WS. */
export async function persistSettings(settings: Record<string, any>,
	spotifySettings: Record<string, any>): Promise<void> {
	const response = await postToServer("saveSettings", { settings, spotifySettings });
	if (response?.result !== true) {
		throw new Error("Settings were not saved by the server.");
	}
}
