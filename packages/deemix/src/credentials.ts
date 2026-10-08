import fs from "fs";
import path from "path";
import { protectWindowsSecret, unprotectWindowsSecret } from "./utils/protectedStorage.js";
import { type LoginFile } from "./types/LoginFile.js";

const DEFAULT_LOGIN: LoginFile = { arl: null };

const loginFile = (configFolder: string) =>
	path.join(configFolder, "login.json");

export function writeLoginCredentials(configFolder: string, login: LoginFile) {
	fs.mkdirSync(configFolder, { recursive: true });

	const persisted = process.platform === "win32" && login.arl
		? { arl: null, protectedArl: protectWindowsSecret(login.arl) }
		: login;
	fs.writeFileSync(loginFile(configFolder), JSON.stringify(persisted, null, 2), { mode: 0o600 });
	if (process.platform !== "win32") fs.chmodSync(loginFile(configFolder), 0o600);
}

export function readLoginCredentials(configFolder: string): LoginFile {
	try {
		const saved = JSON.parse(fs.readFileSync(loginFile(configFolder)).toString());
		if (typeof saved.protectedArl === "string")
			return { arl: unprotectWindowsSecret(saved.protectedArl) };
		if (typeof saved.arl === "string" && process.platform === "win32")
			writeLoginCredentials(configFolder, { arl: saved.arl });
		return { arl: typeof saved.arl === "string" ? saved.arl : null };
	} catch {
		return { ...DEFAULT_LOGIN };
	}
}
