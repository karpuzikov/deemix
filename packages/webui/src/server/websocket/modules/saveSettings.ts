import { WebSocket, WebSocketServer } from "ws";
import { logger } from "@/helpers/logger.js";
import { DeemixApp } from "@/deemixApp.js";
import type { Settings, SpotifySettings } from "deemix";
const eventName = "saveSettings";
export interface SaveSettingsData {
	settings: Settings;
	spotifySettings: SpotifySettings;
}
const cb = (
	data: SaveSettingsData,
	ws: WebSocket,
	__: WebSocketServer,
	deemix: DeemixApp
) => {
	const settings = data?.settings;
	const spotifySettings = data?.spotifySettings;
	if (!settings || typeof settings !== "object" || Array.isArray(settings) ||
		!settings.tags || typeof settings.tags !== "object" ||
		!spotifySettings || typeof spotifySettings !== "object" || Array.isArray(spotifySettings)) {
		ws.send(JSON.stringify({ key: "errorMessage", data: { message: "Invalid settings supplied." } }));
		return;
	}
	try {
		deemix.saveSettings(settings, spotifySettings);
		logger.info("Settings saved");
		deemix.listener.send("updateSettings", { settings, spotifySettings });
	} catch (error) {
		logger.error(error);
		ws.send(JSON.stringify({ key: "errorMessage", data: { message: "Could not save settings." } }));
	}
};
export default { eventName, cb };
