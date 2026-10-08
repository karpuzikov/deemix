import { execSync } from "child_process";
import fs from "fs";
import { homedir } from "os";
import { join, sep } from "path";


const homedata = homedir();
let userdata = "";
let musicdata = "";

function canWriteLocally(folder: string): boolean {
	try {
		fs.accessSync(folder, fs.constants.R_OK | fs.constants.W_OK);
		return true;
	} catch {
		return false;
	}
}

function checkPath(path: string) {
	if (path === "") return "";
	if (!fs.existsSync(path)) return "";
	if (!canWriteLocally(path)) return "";
	return path;
}

export function getConfigFolder() {
	if (userdata !== "") return userdata;

	if (process.env.DEEMIX_DATA_DIR)
		return process.env.DEEMIX_DATA_DIR.replace(/\/*$/, "") + "/";

	// Use the user's actual Documents known folder, including redirected folders
	// (e.g. OneDrive), and migrate legacy AppData without losing settings.
	if (process.platform === "win32") {
		try {
			const script = "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; [Environment]::GetFolderPath('MyDocuments')";
			const documents = execSync("powershell.exe -NoLogo -NoProfile -NonInteractive -Command \"" + script + "\"", {
				encoding: "utf8",
				windowsHide: true,
				timeout: 15000,
			}).trim();
			if (documents) {
				const target = join(documents, "Karpuzikov Tools", "Deemix");
				const legacy = process.env.APPDATA ? join(process.env.APPDATA, "deemix") : "";
				if (!fs.existsSync(target) && legacy && fs.existsSync(legacy))
					fs.cpSync(legacy, target, { recursive: true });
				fs.mkdirSync(target, { recursive: true });
				userdata = target + sep;
				return userdata;
			}
		} catch {
			// Preserve the former AppData behavior when the known folder cannot
			// be resolved, rather than preventing the application from starting.
		}
	}


	if (process.env.XDG_CONFIG_HOME && userdata === "") {
		userdata = `${process.env.XDG_CONFIG_HOME}${sep}`;
		userdata = checkPath(userdata);
	}
	if (process.env.APPDATA && userdata === "") {
		userdata = `${process.env.APPDATA}${sep}`;
		userdata = checkPath(userdata);
	}
	if (process.platform === "darwin" && userdata === "") {
		userdata = `${homedata}/Library/Application Support/`;
		userdata = checkPath(userdata);
	}
	if (userdata === "") {
		userdata = `${homedata}${sep}.config${sep}`;
		userdata = checkPath(userdata);
	}

	if (userdata === "") userdata = `${process.cwd()}${sep}config${sep}`;
	else userdata += `deemix${sep}`;

	return userdata;
}

export function getMusicFolder() {
	if (musicdata !== "") return musicdata;

	if (process.env.DEEMIX_MUSIC_DIR)
		return process.env.DEEMIX_MUSIC_DIR.replace(/\/*$/, "") + "/";

	if (process.env.XDG_MUSIC_DIR && musicdata === "") {
		musicdata = `${process.env.XDG_MUSIC_DIR}${sep}`;
		musicdata = checkPath(musicdata);
	}
	if (fs.existsSync(`${homedata}${sep}.config${sep}user-dirs.dirs`)) {
		const userDirs = fs
			.readFileSync(`${homedata}${sep}.config${sep}user-dirs.dirs`)
			.toString();
		musicdata = userDirs.match(/XDG_MUSIC_DIR="(.*)"/)?.[1] ?? "";
		if (musicdata) musicdata = musicdata.replace(
			/\$([A-Z_]+[A-Z0-9_]*)/gi,
			(_, envName) => process.env[envName] ?? ""
		);
		musicdata += sep;
		musicdata = checkPath(musicdata);
	}
	if (process.platform === "win32" && musicdata === "") {
		try {
			const musicKeys = ["My Music", "{4BD8D571-6D19-48D3-BE97-422220080E43}"];
			const regData = execSync(
				'reg.exe query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Shell Folders"'
			)
				.toString()
				.split("\r\n");
			for (let i = 0; i < regData.length; i++) {
				const line = regData[i];
				if (line === "") continue;
				if (i === 1) continue;
				const lines = line.split("    ");
				if (musicKeys.includes(lines[1])) {
					musicdata = lines[3] + sep;
					break;
				}
			}
			musicdata = checkPath(musicdata);
		} catch {
			/* empty */
		}
	}
	if (musicdata === "") {
		musicdata = `${homedata}${sep}Music${sep}`;
		musicdata = checkPath(musicdata);
	}

	if (musicdata === "") musicdata = `${process.cwd()}${sep}music${sep}`;
	else musicdata += `deemix Music${sep}`;

	return musicdata;
}
