import fs from "node:fs/promises";
import path from "node:path";

async function trimWindowsElectronLocales(buildPath, platform) {
	if (platform !== "win32") return;

	const localesPath = path.join(buildPath, "locales");
	let files;
	try {
		files = await fs.readdir(localesPath);
	} catch {
		return;
	}

	await Promise.all(
		files
			.filter((file) => file !== "en-US.pak")
			.map((file) => fs.rm(path.join(localesPath, file), { force: true }))
	);
}

export default {
	packagerConfig: {
		name: "Deemix",
		asar: true,
		prune: true,
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
	hooks: {
		packageAfterExtract: async (_config, buildPath, _electronVersion, platform) => {
			await trimWindowsElectronLocales(buildPath, platform);
		},
	},
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
