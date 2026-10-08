import type { ApiHandler } from "@/types.js";
import type { Settings, SpotifySettings } from "deemix";

const path = "/saveSettings";
export interface SaveSettingsData {
	settings: Settings;
	spotifySettings: SpotifySettings;
}

const handler: ApiHandler["handler"] = (req, res) => {
	const { settings, spotifySettings } = (req.body ?? {}) as Partial<SaveSettingsData>;
	if (!settings || typeof settings !== "object" || Array.isArray(settings) ||
		!settings.tags || typeof settings.tags !== "object" ||
		!spotifySettings || typeof spotifySettings !== "object" || Array.isArray(spotifySettings)) {
		res.status(400).send({ error: "Invalid settings: settings, tags, and spotifySettings objects are required." });
		return;
	}
	try {
		const deemix = req.app.get("deemix");
		deemix.saveSettings(settings, spotifySettings);
		deemix.listener.send("updateSettings", { settings, spotifySettings });
		res.send({ result: true });
	} catch {
		res.status(500).send({ error: "Could not save settings." });
	}
};

export default { path, handler };
