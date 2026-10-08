import { deemixApp } from "deemix-webui";
import {
	app,
	BrowserWindow,
	dialog,
	ipcMain,
	Menu,
	MenuItem,
	shell,
} from "electron";
import contextMenu from "electron-context-menu";
import fs from "fs";
import { fileURLToPath } from "node:url";
import { platform } from "os";
import { join } from "path";
import { hideBin } from "yargs/helpers";
import yargs from "yargs/yargs";

// eslint-disable-next-line @typescript-eslint/no-require-imports
if (require("electron-squirrel-startup") === true) app.quit();

const argv = await yargs(hideBin(process.argv)).options({
	port: { type: "string", default: "6595" },
	host: { type: "string", default: "127.0.0.1" },
	dev: { type: "boolean", default: false },
}).argv;

import path from "node:path";

const PORT = process.env.DEEMIX_SERVER_PORT || argv.port;
process.env.DEEMIX_SERVER_PORT = PORT;
process.env.DEEMIX_HOST = argv.host;

let win: BrowserWindow | null = null;

const windowStatePath = join(app.getPath("userData"), "window-state.json");

function getWindowState() {
	try {
		const data = fs.readFileSync(windowStatePath, "utf-8");
		return JSON.parse(data);
	} catch {
		return { width: 800, height: 600, isMaximized: false };
	}
}

function saveWindowState(win: BrowserWindow) {
	if (!win) return;
	const bounds = win.getNormalBounds();
	const isMaximized = win.isMaximized();
	fs.writeFileSync(windowStatePath, JSON.stringify({ ...bounds, isMaximized }));
}

async function main() {
	const state = getWindowState();
	win = new BrowserWindow({
		width: state.width || 800,
		height: state.height || 600,
		x: state.x,
		y: state.y,
		useContentSize: true,
		autoHideMenuBar: true,
		icon: join(
			path.dirname(fileURLToPath(import.meta.url)),
			platform() === "win32" ? "build/icon.ico" : "build/64x64.png"
		),
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			sandbox: true,
			preload: join(path.dirname(fileURLToPath(import.meta.url)), "preload.js"),
		},
	});

	if (state.isMaximized) {
		win.maximize();
	}

	if (process.env.NODE_ENV === "development") {
		win.setMenu(null);

		const menu = new Menu();
		menu.append(
			new MenuItem({
				label: "DevTools",
				submenu: [
					{
						role: "reload",
						accelerator: "f5",
						click: () => {
							win.reload();
						},
					},
					{
						role: "toggleDevTools",
						accelerator: "f12",
						click: () => {
							win.webContents.toggleDevTools();
						},
					},
				],
			})
		);
		Menu.setApplicationMenu(menu);
	}

	const origin = `http://127.0.0.1:${PORT}`;
	const openSafeExternal = (url: string) => {
		try {
			const parsed = new URL(url);
			if (parsed.protocol === "https:" ||
				(parsed.protocol === "http:" && parsed.origin === origin)) void shell.openExternal(parsed.href);
		} catch { /* Block malformed URLs. */ }
	};
	win.webContents.setWindowOpenHandler(({ url }) => {
		openSafeExternal(url);
		return { action: "deny" };
	});
	win.webContents.on("will-navigate", (event, url) => {
		try { if (new URL(url).origin === origin) return; }
		catch { /* Block malformed navigation. */ }
		event.preventDefault();
		openSafeExternal(url);
	});

	win.loadURL(`http://127.0.0.1:${PORT}`);

	win.on("close", () => {
		saveWindowState(win!);
		if (deemixApp.getSettings().settings.clearQueueOnExit) {
			deemixApp.cancelAllDownloads();
		}
	});
}

app.on("ready", async () => {
	main();

	contextMenu({
		showLookUpSelection: false,
		showSearchWithGoogle: false,
		showInspectElement: false,
	});

	// Only one istance per time
	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			main();
		}
	});
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});

ipcMain.on("openDownloadsFolder", (event) => {
	if (!isTrustedSender(event)) return;
	shell.openPath(deemixApp.getDownloadLocation());
});

const isTrustedSender = (event: { sender: { getURL(): string } }) => {
	try { return new URL(event.sender.getURL()).origin === `http://127.0.0.1:${PORT}`; }
	catch { return false; }
};
ipcMain.on("openFolder", (event, folderPath) => {
	if (!isTrustedSender(event) || typeof folderPath !== "string" || !folderPath.trim()) return;
	const resolvedPath = path.resolve(folderPath);
	const root = path.resolve(deemixApp.getDownloadLocation());
	const relative = path.relative(root, resolvedPath);
	if (relative.startsWith("..") || path.isAbsolute(relative) || !fs.existsSync(resolvedPath)) return;
	if (fs.statSync(resolvedPath).isDirectory()) void shell.openPath(resolvedPath);
	else shell.showItemInFolder(resolvedPath);
});

ipcMain.handle("selectSessionDownloadFolder", async (event) => {
	if (!isTrustedSender(event)) return null;
	if (!win) return null;
	const result = await dialog.showOpenDialog(win, {
		defaultPath: deemixApp.getDownloadLocation(),
		properties: ["openDirectory", "createDirectory"],
	});
	const selectedPath = result.filePaths[0];
	if (!selectedPath) return null;

	return deemixApp.setSessionDownloadLocation(selectedPath);
});

ipcMain.on("selectDownloadFolder", async (event, downloadLocation) => {
	if (!isTrustedSender(event) || !win) return;
	const path = await dialog.showOpenDialog(win, {
		defaultPath: downloadLocation,
		properties: ["openDirectory", "createDirectory"],
	});
	if (path.filePaths[0])
		win.webContents.send("downloadFolderSelected", path.filePaths[0]);
});
