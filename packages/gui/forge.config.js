import fs from "node:fs/promises";
import path from "node:path";

async function trimWindowsElectronLocales(buildPath, _electronVersion, platform, _arch, callback) {
	try {
		if (platform === "win32") {
			const localesPath = path.join(buildPath, "locales");
			const files = await fs.readdir(localesPath);
			await Promise.all(
				files
					.filter((file) => file !== "en-US.pak")
					.map((file) => fs.rm(path.join(localesPath, file), { force: true }))
			);
		}
		callback();
	} catch (error) {
		callback(error);
	}
}

export default {
	packagerConfig: {
		name: "Deemix",
		asar: true,
		prune: true,
		afterExtract: [trimWindowsElectronLocales],
		ignore: [
			/^\/node_modules/,
			/^\/out/,
			/^\/src/,
			/^\/public/,
			/^\/scripts/,
			/^\/.gitignore/,
			/^\/forge.config.js/,
			/^\/tsconfig.json/,
		],
		icon: "./build/icon.ico",
		executableName: "deemix-gui",
	},
	rebuildConfig: {},
	makers: [
		{
			name: "@electron-forge/maker-squirrel",
			config: {},
		},
		{
			name: "@electron-forge/maker-zip",
			config: {},
		},
		{
			name: "@electron-forge/maker-deb",
			config: {
				options: {
					name: "deemix",
					productName: "Deemix",
					section: "sound",
					icon: "./build/icon.ico",
					categories: ["Audio"],
				},
			},
		},
	],
	plugins: [
		{
			name: "@electron-forge/plugin-auto-unpack-natives",
			config: {},
		},
	],
};
