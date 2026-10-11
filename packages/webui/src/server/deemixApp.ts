import { CantStream, NotLoggedIn } from "@/helpers/errors.js";
import { logger } from "@/helpers/logger.js";
import { GUI_VERSION, WEBUI_PACKAGE_VERSION } from "@/helpers/versions.js";
import {
	Collection,
	Convertable,
	DEFAULT_SETTINGS,
	Downloader,
	generateDownloadObject,
	loadSettings,
	saveSettings,
	Single,
	SpotifyPlugin,
	ListenBrainzPlugin,
	utils,
	type DownloadObject,
	type Listener,
	type Settings,
	type SpotifySettings,
	type PluginRegistry,
	isConvertiblePlugin,
	preferExplicitReleases,
} from "deemix";
import { Deezer, setDeezerCacheDir } from "deezer-sdk";
import fs from "fs";
import got, { type Response as GotResponse } from "got";
import { sep } from "path";
import { v4 as uuidv4 } from "uuid";

// Constants
export const configFolder: string = utils.getConfigFolder();
setDeezerCacheDir(configFolder);
export const defaultSettings: Settings = DEFAULT_SETTINGS;

export const sessionDZ: Record<string, Deezer> = {};

type DeezerAvailable = "yes" | "no" | "no-network";

type AppPlugins = PluginRegistry & {
	spotify: SpotifyPlugin;
	listenbrainz: ListenBrainzPlugin;
};

export class DeemixApp {
	queueOrder: string[];
	queue: Record<string, any>;
	currentJob: boolean | Downloader | null;
	queuePaused: boolean;
	stopCleanupRequested: boolean;
	resumeRequested: boolean;

	deezerAvailable?: DeezerAvailable;
	latestVersion: string | null;

	plugins: AppPlugins;
	settings: Settings;
	sessionDownloadLocation: string | null;

	listener: Listener;

	constructor(listener: Listener) {
		this.settings = loadSettings(configFolder);
		this.sessionDownloadLocation = null;

		this.queueOrder = [];
		this.queue = {};
		this.currentJob = null;
		this.stopCleanupRequested = false;
		this.resumeRequested = false;
		try {
			this.queuePaused = JSON.parse(fs.readFileSync(configFolder + "queue-state.json", "utf8"))?.paused === true;
		} catch {
			this.queuePaused = false;
		}

		this.plugins = {
			spotify: new SpotifyPlugin(),
			listenbrainz: new ListenBrainzPlugin(),
		};
		this.latestVersion = null;
		this.listener = listener;

		this.plugins.spotify.setup();
		this.plugins.listenbrainz.setup();
		this.restoreQueueFromDisk();
	}

	async isDeezerAvailable() {
		if (this.deezerAvailable) return this.deezerAvailable;

		let response: GotResponse<string>;
		try {
			response = await got.get("https://www.deezer.com/", {
				headers: {
					Cookie:
						"dz_lang=en; Domain=deezer.com; Path=/; Secure; hostOnly=false;",
				},
				
				retry: {
					limit: 5,
				},
			});
		} catch (e) {
			logger.error(e);
			this.deezerAvailable = "no-network";

			return this.deezerAvailable;
		}
		const title =
			response.body.match(/<title[^>]*>([^<]+)<\/title>/)?.[1]?.trim() ?? "";

		this.deezerAvailable =
			title !== "Deezer will soon be available in your country." ? "yes" : "no";

		return this.deezerAvailable;
	}

	async getLatestVersion(force = false): Promise<string | null> {
		if (this.latestVersion === null || force) {
			try {
				const responseJson = await got
					.get(
						`https://raw.githubusercontent.com/karpuzikov/deemix/main/packages/${GUI_VERSION !== undefined ? "gui" : "webui"}/package.json`
					)
					.json();
				this.latestVersion = JSON.parse(JSON.stringify(responseJson)).version;
			} catch (e) {
				logger.error(e);
				this.latestVersion = "NotFound";
				return this.latestVersion;
			}
		}
		return this.latestVersion;
	}

	parseVersion(version: string | null): any {
		if (version === null || version === "continuous" || version === "NotFound")
			return null;
		try {
			const matchResult =
				version.match(/(\d+)\.(\d+)\.(\d+)-r(\d+)\.(.+)/) || [];
			return {
				year: parseInt(matchResult[1]),
				month: parseInt(matchResult[2]),
				day: parseInt(matchResult[3]),
				revision: parseInt(matchResult[4]),
				commit: matchResult[5] || "",
			};
		} catch (e) {
			logger.error(e);
			return null;
		}
	}

	isUpdateAvailable(): boolean {
		if (!this.latestVersion || this.latestVersion === "NotFound") return false;
		return (
			this.latestVersion.localeCompare(
				GUI_VERSION ?? WEBUI_PACKAGE_VERSION,
				undefined,
				{ numeric: true }
			) === 1
		);
	}

	getSettings() {
		return {
			settings: this.settings,
			defaultSettings,
			spotifySettings: this.plugins.spotify.getSettings(),
		};
	}

	saveSettings(newSettings: Settings, newSpotifySettings: SpotifySettings) {
		saveSettings(newSettings, configFolder);
		this.settings = newSettings;
		this.plugins.spotify.saveSettings(newSpotifySettings);
		// Reconcile releases already waiting when the option is first enabled.
		// Never cancel a current download or delete completed tracks on disk.
		if (this.settings.skipCleanIfExplicitAvailable) {
			const waiting = this.getWaitingQueueItems();
			const { supersededWaiting } = preferExplicitReleases([], waiting);
			const removed = this.removeSupersededWaiting(supersededWaiting);
			if (removed) {
				logger.info(`Removed ${removed} previously queued clean release(s) on settings save`);
				this.listener.send("skippedCleanVersions", { count: removed });
			}
		}
	}

	getDownloadLocation(): string {
		return this.sessionDownloadLocation || this.settings.downloadLocation;
	}

	setSessionDownloadLocation(downloadLocation: string | null): string {
		const normalized =
			typeof downloadLocation === "string" ? downloadLocation.trim() : "";
		this.sessionDownloadLocation = normalized || null;
		return this.getDownloadLocation();
	}

	private getEffectiveSettings(): Settings {
		if (!this.sessionDownloadLocation) return this.settings;
		return {
			...this.settings,
			downloadLocation: this.sessionDownloadLocation,
		};
	}

	getQueue() {
		const result: any = {
			queue: this.queue,
			queueOrder: this.queueOrder,
			queuePaused: this.queuePaused,
		};

		if (this.currentJob instanceof Downloader) {
			result.current = this.currentJob.downloadObject.getSlimmedDict();
		}

		return result;
	}

	private getWaitingQueueItems(): any[] {
		return this.queueOrder.flatMap(uuid => {
			if (this.queue[uuid]?.status !== "inQueue") return [];
			try {
				return [JSON.parse(fs.readFileSync(this.queueFile(uuid), "utf8"))];
			} catch (error) {
				logger.warn(`Could not inspect waiting release ${uuid}: ${String(error)}`);
				return [];
			}
		});
	}

	private removeSupersededWaiting(items: any[]): number {
		let removed = 0;
		for (const item of items) {
			if (this.queue[item.uuid]?.status === "inQueue") {
				this.cancelDownload(item.uuid);
				removed++;
			}
		}
		return removed;
	}

	private persistPausedState(): void {
		this.writeQueueJson(configFolder + "queue-state.json", { paused: this.queuePaused });
	}

	pauseQueue(stopAndClean = false): void {
		this.queuePaused = true;
		this.stopCleanupRequested ||= stopAndClean;
		this.resumeRequested = false;
		this.persistPausedState();
		if (this.currentJob instanceof Downloader) this.currentJob.requestStop();
		this.listener.send("queueControlChanged", { paused: true, stopping: stopAndClean });
	}

	resumeQueue(dz: Deezer): void {
		this.queuePaused = false;
		this.persistPausedState();
		this.resumeRequested = this.currentJob !== null;
		this.listener.send("queueControlChanged", { paused: false, stopping: false });
		if (this.currentJob === null) void this.startQueue(dz);
	}

	removeErroredDownloads(): string[] {
		const removed: string[] = [];
		for (const [uuid, item] of Object.entries(this.queue)) {
			if (item.status !== "failed" && item.status !== "withErrors" &&
				!(item.status === "completed" && Array.isArray(item.errors) && item.errors.length)) continue;
			this.removeQueueFile(uuid);
			delete this.queue[uuid];
			removed.push(uuid);
		}
		this.queueOrder = this.queueOrder.filter(uuid => !removed.includes(uuid));
		this.persistQueueOrder();
		if (removed.length) this.listener.send("removedErroredDownloads", { uuids: removed });
		return removed;
	}

	private queueFile(uuid: string): string {
		return configFolder + `queue${sep}${uuid}.json`;
	}

	private writeQueueJson(filePath: string, value: unknown): void {
		fs.mkdirSync(configFolder + "queue", { recursive: true });
		const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
		try {
			fs.writeFileSync(tempPath, JSON.stringify(value));
			try {
				fs.renameSync(tempPath, filePath);
			} catch {
				// Windows can occasionally refuse replacement if the destination
				// is momentarily held open. Fall back to replace-then-rename.
				fs.rmSync(filePath, { force: true });
				fs.renameSync(tempPath, filePath);
			}
		} finally {
			fs.rmSync(tempPath, { force: true });
		}
	}

	private persistQueueOrder(): void {
		this.writeQueueJson(
			configFolder + `queue${sep}order.json`,
			this.queueOrder
		);
	}

	private removeQueueFile(uuid: string): void {
		fs.rmSync(this.queueFile(uuid), { force: true });
	}

	async addToQueue(
		dz: Deezer,
		url: string[],
		bitrate: number,
		retry: boolean = false
	) {
		if (!dz.loggedIn) throw new NotLoggedIn();
		if (
			!this.settings.feelingLucky &&
			((!dz.currentUser.can_stream_lossless && bitrate === 9) ||
				(!dz.currentUser.can_stream_hq && bitrate === 3))
		)
			throw new CantStream(bitrate);

		let downloadObjs: DownloadObject[] = [];
		const downloadErrors: any[] = [];
		let link = "";
		const requestUUID = uuidv4();

		if (url.length > 1) {
			this.listener.send("startGeneratingItems", {
				uuid: requestUUID,
				total: url.length,
			});
		}

		for (let i = 0; i < url.length; i++) {
			link = url[i];
			logger.info(`Adding ${link} to queue`);
			try {
				const downloadObj = await generateDownloadObject(
					dz,
					link,
					bitrate,
					this.plugins,
					this.listener
				);

				if (Array.isArray(downloadObj)) {
					downloadObjs = downloadObjs.concat(downloadObj);
				} else if (downloadObj) {
					downloadObjs.push(downloadObj);
				}
			} catch (e) {
				downloadErrors.push(e);
			}
		}

		logger.info(`Explicit-first setting: ${this.settings.skipCleanIfExplicitAvailable ? "enabled" : "disabled"}; generated ${downloadObjs.length} item(s)`);
		if (this.settings.skipCleanIfExplicitAvailable) {
			// Include earlier submissions that are still waiting. A clean album
			// can be queued before the corresponding explicit album arrives.
			const waiting = this.getWaitingQueueItems();
			const active = this.currentJob instanceof Downloader
				? [this.currentJob.downloadObject] : [];
			const selection = preferExplicitReleases(downloadObjs, waiting, active);
			downloadObjs = selection.kept;

			// Only cancel not-yet-started clean items. Never alter a download
			// already in progress or remove completed music on disk.
			const removed = this.removeSupersededWaiting(selection.supersededWaiting);
			const skipped = selection.skipped.length + removed;
			if (skipped) {
				logger.info(`Skipped ${skipped} clean release(s) with matching explicit releases`);
				this.listener.send("skippedCleanVersions", { count: skipped });
			}
		}

		if (downloadErrors.length) {
			downloadErrors.forEach((e) => {
				if (!e.errid) logger.error(e);
				this.listener.send("queueError", {
					link: e.link,
					error: e.message,
					errid: e.errid,
				});
			});
		}

		if (url.length > 1) {
			this.listener.send("finishGeneratingItems", {
				uuid: requestUUID,
				total: downloadObjs.length,
			});
		}

		const slimmedObjects: Record<string, any>[] = [];

		downloadObjs.forEach((downloadObj) => {
			// Check if element is already in queue
			if (Object.keys(this.queue).includes(downloadObj.uuid) && !retry) {
				this.listener.send("alreadyInQueue", downloadObj.getEssentialDict());
				return;
			}

			// Save queue status when adding something to the queue
			fs.mkdirSync(configFolder + "queue", { recursive: true });

			this.queueOrder.push(downloadObj.uuid);
			this.persistQueueOrder();
			this.queue[downloadObj.uuid] = downloadObj.getEssentialDict();
			this.queue[downloadObj.uuid].status = "inQueue";

			this.writeQueueJson(this.queueFile(downloadObj.uuid), {
				...downloadObj.toDict(),
				status: "inQueue",
			});

			slimmedObjects.push(downloadObj.getSlimmedDict());
		});
		if (slimmedObjects.length === 1)
			this.listener.send("addedToQueue", slimmedObjects[0]);
		else this.listener.send("addedToQueue", slimmedObjects);

		if (!this.queuePaused) void this.startQueue(dz);
		return slimmedObjects;
	}

	async startQueue(dz: Deezer): Promise<null> {
		if (this.currentJob !== null || this.queuePaused) return null;
		while (this.queueOrder.length && !this.queuePaused) {
			this.currentJob = true;
			let currentUUID = "";
			let currentItem: any = null;
			let interrupted = false;
			try {
				currentUUID = this.queueOrder.shift() || "";
				if (!currentUUID || !this.queue[currentUUID]) continue;
				this.persistQueueOrder();
				currentItem = JSON.parse(fs.readFileSync(this.queueFile(currentUUID), "utf8"));
				this.queue[currentUUID].status = "downloading";
				this.writeQueueJson(this.queueFile(currentUUID), {
					...currentItem, status: "downloading",
				});

				let downloadObject: Single | Collection | Convertable;
				const effectiveSettings = this.getEffectiveSettings();
				switch (currentItem.__type__) {
					case "Single": downloadObject = new Single(currentItem); break;
					case "Collection": downloadObject = new Collection(currentItem); break;
					case "Convertable": {
						const convertable = new Convertable(currentItem);
						const plugin = this.plugins[convertable.plugin];
						if (!isConvertiblePlugin(plugin)) throw new Error(
							`Plugin "${convertable.plugin}" cannot convert queued items`
						);
						downloadObject = await plugin.convert(
							dz, convertable, effectiveSettings, this.listener
						);
						this.writeQueueJson(this.queueFile(downloadObject.uuid), {
							...downloadObject.toDict(), status: "downloading",
						});
						break;
					}
					default: throw new Error(
						`Unsupported queued item type: ${String(currentItem.__type__)}`
					);
				}
				if (!this.queuePaused) {
					this.currentJob = new Downloader(
						dz, downloadObject, effectiveSettings, this.listener
					);
					this.listener.send("startDownload", currentUUID);
					await this.currentJob.start();
				}
				interrupted = this.queuePaused || this.resumeRequested || downloadObject.isCanceled;
				if (!interrupted && this.queue[currentUUID]) {
					const status = downloadObject.failed === downloadObject.size &&
						downloadObject.size !== 0 ? "failed" :
						downloadObject.failed > 0 ? "withErrors" : "completed";
					const saved = { ...downloadObject.getSlimmedDict(), status };
					this.queue[currentUUID] = saved;
					this.writeQueueJson(this.queueFile(currentUUID), saved);
				}
			} catch (error) {
				interrupted = this.queuePaused || this.resumeRequested ||
					(this.currentJob instanceof Downloader &&
						this.currentJob.downloadObject.isCanceled);
				if (!interrupted) {
					const reason = error instanceof Error ? error : new Error(String(error));
					logger.error(reason);
					if (currentUUID && this.queue[currentUUID]) {
						const failed = {
							...(currentItem || this.queue[currentUUID]), status: "failed",
						};
						this.queue[currentUUID] = failed;
						this.writeQueueJson(this.queueFile(currentUUID), failed);
						this.listener.send("updateQueue", {
							uuid: currentUUID, failed: true,
							error: reason.message, type: "queue",
						});
					}
				}
			} finally {
				if (interrupted && currentUUID && this.queue[currentUUID]) {
					if (this.stopCleanupRequested && this.currentJob instanceof Downloader) {
						this.currentJob.cleanupIncompleteRelease();
					}
					const saved = {
						...currentItem, status: "inQueue", downloaded: 0, failed: 0,
						progress: 0, errors: [], files: [], extrasPath: "",
					};
					this.queue[currentUUID] = saved;
					this.writeQueueJson(this.queueFile(currentUUID), saved);
					if (!this.queueOrder.includes(currentUUID)) this.queueOrder.unshift(currentUUID);
					this.listener.send("queueItemReset", { uuid: currentUUID, item: saved });
				}
				this.persistQueueOrder();
				this.currentJob = null;
				this.stopCleanupRequested = false;
				this.resumeRequested = false;
			}
		}
		return null;
	}

	cancelDownload(uuid: string) {
		if (Object.keys(this.queue).includes(uuid)) {
			switch (this.queue[uuid].status) {
				case "downloading":
					if (this.currentJob instanceof Downloader) {
						this.currentJob.requestStop();
					}
					this.listener.send("cancellingCurrentItem", uuid);
					break;
				case "inQueue": {
					const index = this.queueOrder.indexOf(uuid);
					if (index !== -1) this.queueOrder.splice(index, 1);
					this.persistQueueOrder();
					this.listener.send("removedFromQueue", { uuid });
					break;
				}

				default:
					this.listener.send("removedFromQueue", { uuid });
					break;
			}
			this.removeQueueFile(uuid);
			delete this.queue[uuid];
		}
	}

	cancelAllDownloads() {
		this.queueOrder = [];
		let currentItem: string | null = null;
		Object.values(this.queue).forEach((downloadObject: any) => {
			if (downloadObject.status === "downloading") {
				if (this.currentJob instanceof Downloader) {
					this.currentJob.requestStop();
				}

				this.listener.send("cancellingCurrentItem", downloadObject.uuid);
				currentItem = downloadObject.uuid;
			}
			this.removeQueueFile(downloadObject.uuid);
			delete this.queue[downloadObject.uuid];
		});
		this.persistQueueOrder();
		this.listener.send("removedAllDownloads", currentItem);
	}

	clearCompletedDownloads() {
		Object.values(this.queue).forEach((downloadObject: any) => {
			if (downloadObject.status === "completed") {
				this.removeQueueFile(downloadObject.uuid);
				delete this.queue[downloadObject.uuid];
			}
		});
		this.listener.send("removedFinishedDownloads");
	}

	restoreQueueFromDisk() {
		fs.mkdirSync(configFolder + "queue", { recursive: true });
		const allItems: string[] = fs.readdirSync(configFolder + "queue");
		allItems.forEach((filename: string) => {
			if (filename === "order.json") {
				try {
					this.queueOrder = JSON.parse(
						fs.readFileSync(configFolder + `queue${sep}order.json`).toString()
					);
				} catch {
					this.queueOrder = [];
					this.persistQueueOrder();
				}
			} else {
				if (filename.endsWith(".tmp")) {
					fs.rmSync(configFolder + `queue${sep}${filename}`, { force: true });
					return;
				}
				let currentItem: any;
				try {
					currentItem = JSON.parse(
						fs.readFileSync(configFolder + `queue${sep}${filename}`).toString()
					);
				} catch {
					fs.rmSync(configFolder + `queue${sep}${filename}`, { force: true });
					return;
				}
				if (
					currentItem.status === "inQueue" ||
					currentItem.status === "downloading"
				) {
					let downloadObject: any;
					switch (currentItem.__type__) {
						case "Single":
							downloadObject = new Single(currentItem);
							// Remove old incompatible queue items
							if (downloadObject.single.trackAPI_gw) {
								fs.rmSync(configFolder + `queue${sep}${filename}`, { force: true });
								return;
							}
							break;
						case "Collection":
							downloadObject = new Collection(currentItem);
							// Remove old incompatible queue items
							if (downloadObject.collection.tracks_gw) {
								fs.rmSync(configFolder + `queue${sep}${filename}`, { force: true });
								return;
							}
							break;
						case "Convertable":
							downloadObject = new Convertable(currentItem);
							break;
						default:
							fs.rmSync(configFolder + `queue${sep}${filename}`, {
								force: true,
							});
							return;
					}
					if (!downloadObject) return;
					this.queue[downloadObject.uuid] = downloadObject.getEssentialDict();
					this.queue[downloadObject.uuid].status = "inQueue";
					if (currentItem.status === "downloading") {
						currentItem.status = "inQueue";
						this.writeQueueJson(
							this.queueFile(downloadObject.uuid),
							currentItem
						);
					}
				} else {
					this.queue[currentItem.uuid] = currentItem;
				}
			}
		});

		const pendingUUIDs = Object.values(this.queue)
			.filter((item: any) => item?.status === "inQueue" && item?.uuid)
			.map((item: any) => String(item.uuid));

		const restoredOrder = this.queueOrder.filter(
			(uuid) => this.queue[uuid]?.status === "inQueue"
		);
		for (const uuid of pendingUUIDs) {
			if (!restoredOrder.includes(uuid)) restoredOrder.push(uuid);
		}
		this.queueOrder = restoredOrder;
		this.persistQueueOrder();
	}
}
