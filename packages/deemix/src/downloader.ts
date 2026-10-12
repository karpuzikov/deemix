import { each, eachLimit, queue } from "async";
import { exec } from "child_process";
import {
	Deezer,
	TrackFormats,
	utils,
	type APIAlbum,
	type APITrack,
} from "deezer-sdk";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { HTTPError } from "got";
import { tmpdir } from "os";
import { streamTrack } from "./decryption.js";
import { Collection } from "./download-objects/Collection.js";
import { DownloadObject } from "./download-objects/DownloadObject.js";
import { Single } from "./download-objects/Single.js";
import { DownloadCanceled, DownloadFailed, ErrorMessages } from "./errors.js";
import { DEFAULT_SETTINGS, OverwriteOption } from "./settings.js";
import { Album } from "./types/Album.js";
import type { Listener } from "./types/listener.js";
import { StaticPicture } from "./types/Picture.js";
import { Playlist } from "./types/Playlist.js";
import type { Settings } from "./types/Settings.js";
import Track, { formatsName } from "./types/Track.js";
import { shellEscape } from "./utils/core.js";
import {
	invalidateCachedISRCTrackID,
	normalizeISRC,
	putCachedISRCTrackID,
	resolveISRCTrackID,
} from "./utils/isrcCache.js";
import { enrichLyricsFromLRCLIB } from "./utils/lyricsFallback.js";
import { withFallbackTimeout } from "./utils/fallbackTimeout.js";
import { enrichMetadataFromMusicBrainz } from "./utils/musicbrainzFallback.js";
import { downloadImage } from "./utils/downloadImage.js";
import { checkShouldDownload, tagTrack } from "./utils/downloadUtils.js";
import { getPreferredBitrate } from "./utils/getPreferredBitrate.js";
import { ReleaseTransaction, recoverReleaseTransactions } from "./utils/releaseTransaction.js";
import {
	generateAlbumName,
	generateArtistName,
	generateDownloadObjectName,
	generatePath,
} from "./utils/pathtemplates.js";

const { mapGwTrackToDeezer: map_track } = utils;

const extensions = {
	[TrackFormats.FLAC]: ".flac",
	[TrackFormats.LOCAL]: ".mp3",
	[TrackFormats.MP3_320]: ".mp3",
	[TrackFormats.MP3_128]: ".mp3",
	[TrackFormats.DEFAULT]: ".mp3",
	[TrackFormats.MP4_RA3]: ".mp4",
	[TrackFormats.MP4_RA2]: ".mp4",
	[TrackFormats.MP4_RA1]: ".mp4",
} as const;

const MAX_FALLBACK_ATTEMPTS = 6;
const ISRC_FALLBACK_BUDGET_MS = 15000;
const ISRC_MAX_ALBUM_LOOKUPS = 3;
const ISRC_MAX_CANDIDATES = 3;
const ISRC_MAX_SEARCH_PAGES = 2;
const METADATA_TIMEOUT_MS = 5000;

const TEMPDIR = tmpdir() + "/deemix-imgs";
mkdirSync(TEMPDIR, { recursive: true });

export class Downloader {
	dz: Deezer;
	downloadObject: DownloadObject;
	settings: Settings;
	bitrate: number;
	listener: Listener;
	playlistCovername?: string;
	playlistURLs: { url: string; ext: string }[];
	coverQueue: Record<string, string>;

	constructor(
		dz: Deezer,
		downloadObject: DownloadObject,
		settings: Settings,
		listener: Listener
	) {
		this.dz = dz;
		this.downloadObject = downloadObject;
		this.settings = settings || DEFAULT_SETTINGS;
		this.bitrate = downloadObject.bitrate;
		this.listener = listener;

		this.playlistURLs = [];

		this.coverQueue = {};
	}

	log(data, state) {
		if (this.listener) {
			this.listener.send("downloadInfo", {
				uuid: this.downloadObject.uuid,
				title: this.downloadObject.title,
				data,
				state,
			});
		}
	}

	warn(data, state, solution) {
		this.listener.send("downloadWarn", {
			uuid: this.downloadObject.uuid,
			data,
			state,
			solution,
		});
	}

	async start() {
		if (this.downloadObject instanceof Single) {
			const track = await this.downloadWrapper({
				trackAPI: this.downloadObject.single.trackAPI,
				albumAPI: this.downloadObject.single.albumAPI,
			});
			if (track) await this.afterDownloadSingle(track);
		} else if (this.downloadObject instanceof Collection) {
			const tracks = [];
			let skipIncompleteRelease = false;

			const existingRelease = this.findExistingCompleteRelease();
			if (existingRelease.complete) {
				this.downloadObject.downloaded = this.downloadObject.size;
				this.downloadObject.extrasPath = existingRelease.folder;
				if (this.listener) {
					this.listener.send("updateQueue", {
						uuid: this.downloadObject.uuid,
						alreadyDownloadedCount: this.downloadObject.size,
						downloadFolder: existingRelease.folder,
						extrasPath: existingRelease.folder,
					});
				}
				this.listener.send("finishDownload", {
					uuid: this.downloadObject.uuid,
					title: this.downloadObject.title,
				});
				return;
			}

			// All Deezer albums must be complete at the requested bitrate,
			// regardless of settings saved by earlier application versions.
			if (this.downloadObject.type === "album") {
				let unavailableTracks: Awaited<ReturnType<Downloader["findUnavailableReleaseTracks"]>>;
				try {
					unavailableTracks = await this.findUnavailableReleaseTracks();
				} catch (error) {
					// Fail closed: never start an album when requested-quality
					// preflight fails. Do not create any music files.
					unavailableTracks = this.downloadObject.collection.tracks.map(track => ({
						id: track.id, title: track.title,
						artist: track.artist?.name || "",
						reason: `Verification failed: ${String(error)}`,
					}));
				}
				if (unavailableTracks.length) {
					skipIncompleteRelease = true;
					const error =
						`Release skipped: ${unavailableTracks.length} of ${this.downloadObject.size} track(s) are unavailable or could not be verified at the selected quality. No tracks were downloaded.`;

					this.downloadObject.errors.push({
						message: error,
						data: { tracks: unavailableTracks },
						type: "post",
					});

					if (this.listener) {
						this.listener.send("updateQueue", {
							uuid: this.downloadObject.uuid,
							postFailed: true,
							error,
							data: { tracks: unavailableTracks },
							type: "post",
						});
					}
				}
			}

			if (!skipIncompleteRelease && this.downloadObject.type === "album") {
				// A successful preflight is NOT enough: country restrictions or
				// stream failures may appear after the first audio file is written.
				await this.downloadStrictAlbum();
			} else if (!skipIncompleteRelease) {
				const q = queue(
					async (data: { track: APITrack; pos: number }, callback) => {
						if (this.downloadObject instanceof Collection) {
							const { track, pos } = data;
							tracks[pos] = await this.downloadWrapper({
								trackAPI: track,
								albumAPI: this.downloadObject.collection.albumAPI,
								playlistAPI: this.downloadObject.collection.playlistAPI,
							});
						}
						callback();
					},
					this.settings.queueConcurrency
				);
				if (this.downloadObject.collection.tracks.length) {
					this.downloadObject.collection.tracks.forEach((track, pos) => {
						q.push({ track, pos }, () => {});
					});
					await q.drain();
				}
				await this.afterDownloadCollection(tracks);
			}
		}

		if (this.downloadObject.isCanceled) {
			this.listener.send("currentItemCancelled", {
				uuid: this.downloadObject.uuid,
				title: this.downloadObject.title,
			});
			this.listener.send("removedFromQueue", {
				uuid: this.downloadObject.uuid,
				title: this.downloadObject.title,
			});
		}

		this.listener.send("finishDownload", {
			uuid: this.downloadObject.uuid,
			title: this.downloadObject.title,
		});
	}

	/**
	 * Exact-quality albums use a private directory on the target volume.
	 * No staged file is visible in the user's release folders until ALL
	 * requested tracks are successfully streamed and tagged at the exact format.
	 * Publication refuses all preexisting file collisions, even if the user
	 * selected an overwrite mode: protecting existing music is mandatory.
	 */
	async downloadStrictAlbum(): Promise<void> {
		if (!(this.downloadObject instanceof Collection)) return;
		const savedSettings = this.settings;
		let transaction: ReleaseTransaction | undefined;
		const expected = this.downloadObject.collection.tracks as APITrack[];
		const results: any[] = new Array(expected.length);

		try {
			recoverReleaseTransactions(savedSettings.downloadLocation);
			transaction = new ReleaseTransaction(savedSettings.downloadLocation);
			this.settings = {
				...savedSettings,
				downloadLocation: transaction.stage,
				overwriteFile: OverwriteOption.DONT_OVERWRITE,
				fallbackBitrate: false,
				// User-configured scripts must never run on private staging files.
				executeCommand: "",
			};
			const q = queue(
				async (data: { track: APITrack; pos: number }, callback) => {
					const { track, pos } = data;
					results[pos] = await this.downloadWrapper(
						{
							trackAPI: track,
							albumAPI: this.downloadObject instanceof Collection
								? this.downloadObject.collection.albumAPI : undefined,
						},
						undefined, true, undefined, true, false, true
					);
					callback();
				},
				Math.max(1, Number(savedSettings.queueConcurrency) || 1)
			);
			for (let pos = 0; pos < expected.length; pos++) {
				q.push({ track: expected[pos], pos }, () => {});
			}
			await q.drain();
			if (this.downloadObject.isCanceled) throw new DownloadCanceled();

			const seen = new Set<string>();
			for (let i = 0; i < expected.length; i++) {
				const item = results[i];
				if (item?.error) {
					throw new Error(
						`Track "${expected[i].title}" cannot be downloaded at the selected quality: ${item.error.message}`
					);
				}
				if (!item?.path || Number(item.bitrate) !== Number(this.bitrate) ||
					!existsSync(item.path) || statSync(item.path).size === 0 ||
					seen.has(item.path)) {
					throw new Error(
						`Track "${expected[i].title}" was not downloaded as a unique, nonempty file at the selected quality`
					);
				}
				seen.add(item.path);
			}
			await this.afterDownloadCollection(results);
			if (this.downloadObject.isCanceled) throw new DownloadCanceled();
			transaction.publish();

			// Once published, report final paths rather than the private stage.
			const stage = transaction;
			const mapPath = (value: string) =>
				value && value.startsWith(stage.stage + "/") || value && value.startsWith(stage.stage + "\\")
					? stage.finalPath(value) : value;
			this.downloadObject.extrasPath = mapPath(this.downloadObject.extrasPath);
			for (const file of this.downloadObject.files) {
				if (file?.path) file.path = mapPath(file.path);
			}
			this.listener?.send("updateQueue", {
				uuid: this.downloadObject.uuid,
				downloadFolder: this.downloadObject.extrasPath,
				extrasPath: this.downloadObject.extrasPath,
			});

			// External command runs only AFTER complete publication.
			if (process.env.DEEMIX_ALLOW_POST_DOWNLOAD_COMMANDS === "true" &&
				savedSettings.executeCommand) {
				try {
					const child = exec(
						savedSettings.executeCommand
							.replaceAll("%folder%", shellEscape(this.downloadObject.extrasPath))
							.replaceAll("%filename%", ""),
						(error, stdout, stderr) => {
							if (error) this.afterDownloadErrorReport("ExecuteCommand", error);
							if (stdout) this.log({ stdout }, "stdout");
							if (stderr) this.log({ stderr }, "stderr");
							}
					);
					await new Promise(resolve => child.on("close", resolve));
				} catch (error) {
					this.afterDownloadErrorReport("ExecuteCommand", error);
				}
			}
		} catch (error) {
			// No preexisting file or directory is deleted, even after a stream failure.
			this.downloadObject.downloaded = 0;
			this.downloadObject.files = [];
			this.downloadObject.extrasPath = "";
			if (!(error instanceof DownloadCanceled) && !this.downloadObject.isCanceled) {
				const message = `Incomplete release discarded: ${String(error instanceof Error ? error.message : error)}`;
				this.downloadObject.failed = Math.max(1, this.downloadObject.failed);
				this.downloadObject.errors.push({ message, type: "post" });
				this.listener?.send("updateQueue", {
					uuid: this.downloadObject.uuid, resetDownloaded: true,
					postFailed: true, error: message, type: "post",
				});
			} else {
				this.listener?.send("updateQueue", {
					uuid: this.downloadObject.uuid, resetDownloaded: true,
				});
			}
		} finally {
			this.settings = savedSettings;
			transaction?.dispose();
		}
	}

	async download(
		extraData: { trackAPI: APITrack; albumAPI?: APIAlbum; playlistAPI?: any },
		track?: Track,
		refetchTrack = true,
		probeOnly = false,
		requireExactBitrate = false
	) {
		const returnData = <any>{};
		const { trackAPI, albumAPI, playlistAPI } = extraData;

		if (this.downloadObject.isCanceled) throw new DownloadCanceled();
		if (trackAPI.id === 0) throw new DownloadFailed("notOnDeezer");

		trackAPI.size = this.downloadObject.size;

		let itemData = {
			id: trackAPI.id,
			title: trackAPI.title,
			artist: trackAPI.artist.name,
		};

		if (!track) {
			track = new Track();
			track.parseTrack(trackAPI);
			if (albumAPI) {
				track.album = new Album(albumAPI.id, albumAPI.title);
				track.album.parseAlbum(albumAPI);
			}
			if (playlistAPI) {
				track.playlist = new Playlist(playlistAPI);
			}
		}

		// Enrich track with additional data
		try {
			const parse = () => track.parseData(
				this.dz, trackAPI.id, trackAPI, albumAPI, playlistAPI, refetchTrack
			);
			if (probeOnly) {
				await withFallbackTimeout(parse, Date.now() + 12000, 12000);
			} else {
				await parse();
			}

			// SpotiFLAC-inspired metadata fallback: only ask LRCLIB when lyrics
			// are actually requested and Deezer did not provide them.
			if (
				!probeOnly &&
				(this.settings.syncedLyrics ||
					this.settings.tags.lyrics ||
					this.settings.tags.syncedLyrics) &&
				track.lyrics &&
				!track.lyrics.sync &&
				!track.lyrics.unsync
			) {
				await enrichLyricsFromLRCLIB(track);
			}

			if (!probeOnly && this.settings.musicBrainzMetadataFallback) {
				await enrichMetadataFromMusicBrainz(track);
			}
		} catch (e) {
			if (e.name === "AlbumDoesntExists") {
				throw new DownloadFailed("albumDoesntExists");
			}
			if (e.name === "MD5NotFound") {
				throw new DownloadFailed("notLoggedIn");
			}
			throw e;
		}

		if (this.downloadObject.isCanceled) throw new DownloadCanceled();

		// Check if the track is encoded
		if (track.MD5 === 0) throw new DownloadFailed("notEncoded", track);

		// Check the target bitrate
		let selectedFormat;
		try {
			const resolveBitrate = () => getPreferredBitrate(
				this.dz,
				track,
				this.bitrate,
				requireExactBitrate ? false : this.settings.fallbackBitrate,
				this.settings.feelingLucky,
				this.downloadObject.uuid,
				this.listener
			);
			selectedFormat = (probeOnly || this.settings.fallbackISRC)
				? await withFallbackTimeout(resolveBitrate, Date.now() + 15000, 15000)
				: await resolveBitrate();
		} catch (e) {
			if (e.name === "WrongLicense") {
				throw new DownloadFailed("wrongLicense");
			}
			if (e.name === "WrongGeolocation") {
				throw new DownloadFailed("wrongGeolocation", track);
			}
			if (e.name === "PreferredBitrateNotFound") {
				throw new DownloadFailed("wrongBitrate", track);
			}
			if (e.name === "TrackNot360") {
				throw new DownloadFailed("no360RA");
			}
			console.error(e);
			throw e;
		}
		if (requireExactBitrate && selectedFormat !== this.bitrate) {
			throw new DownloadFailed("wrongBitrate", track);
		}
		track.bitrate = selectedFormat;
		track.album.bitrate = selectedFormat;

		if (probeOnly) {
			return {
				probeAvailable: selectedFormat === this.bitrate,
				bitrate: selectedFormat,
				trackID: track.id,
			};
		}

		track.applySettings(this.settings);

		const { filename, filepath, artistPath, coverPath, extrasPath } =
			generatePath(track, this.downloadObject.type, this.settings);

		if (extrasPath && !this.downloadObject.extrasPath) {
			this.downloadObject.extrasPath = extrasPath;
		}
		const downloadFolder = String(extrasPath || filepath);

		// Make sure the filepath exsists
		mkdirSync(filepath, { recursive: true });
		const extension = extensions[track.bitrate];
		let writepath = `${filepath}/${filename}${extension}`;

		const shouldDownload = checkShouldDownload(
			filename,
			filepath,
			extension,
			writepath,
			this.settings.overwriteFile,
			track
		);

		// Adding tags
		if (
			!shouldDownload &&
			[OverwriteOption.ONLY_TAGS, OverwriteOption.OVERWRITE].includes(
				this.settings.overwriteFile
			)
		) {
			tagTrack(extension, writepath, track, this.settings.tags);
		}

		if (!shouldDownload) {
			if (this.listener) {
				this.listener.send("updateQueue", {
					uuid: this.downloadObject.uuid,
					alreadyDownloaded: true,
					downloadPath: writepath,
					downloadFolder,
					extrasPath: this.downloadObject.extrasPath,
				});
			}

			returnData.filename = writepath.slice(extrasPath.length + 1);
			returnData.data = itemData;
			returnData.path = String(writepath);
			returnData.bitrate = track.bitrate;

			this.downloadObject.files.push(returnData);

			if (
				this.downloadObject instanceof Single ||
				this.downloadObject instanceof Collection
			) {
				this.downloadObject.completeTrackProgress(this.listener);
			}

			this.downloadObject.downloaded += 1;
			return returnData;
		}

		if (this.downloadObject.isCanceled) throw new DownloadCanceled();

		if (this.settings.overwriteFile === OverwriteOption.KEEP_BOTH) {
			const originalFilename = `${filepath}/${filename}`;

			let c = 0;
			let currentFilename = originalFilename;
			while (existsSync(currentFilename + extension)) {
				c++;
				currentFilename = `${originalFilename} (${c})`;
			}

			writepath = currentFilename + extension;
		}

		itemData = {
			id: track.id,
			title: track.title,
			artist: track.mainArtist.name,
		};

		// Save extrasPath
		if (extrasPath && !this.downloadObject.extrasPath) {
			this.downloadObject.extrasPath = extrasPath;
		}

		// Generate covers URLs
		let embeddedImageFormat = `jpg-${this.settings.jpegImageQuality}`;
		if (this.settings.embeddedArtworkPNG) embeddedImageFormat = "png";

		track.album.embeddedCoverURL = track.album.pic.getURL(
			this.settings.embeddedArtworkSize,
			embeddedImageFormat
		);
		let ext = track.album.embeddedCoverURL.slice(-4);
		if (ext.charAt(0) !== ".") ext = ".jpg";
		track.album.embeddedCoverPath = `${TEMPDIR}/${
			track.album.isPlaylist ? "pl" + track.playlist.id : "alb" + track.album.id
		}_${this.settings.embeddedArtworkSize}${ext}`;

		// Download and cache the coverart
		if (!this.coverQueue[track.album.embeddedCoverPath]) {
			this.coverQueue[track.album.embeddedCoverPath] = await downloadImage(
				track.album.embeddedCoverURL,
				track.album.embeddedCoverPath
			);
		}
		track.album.embeddedCoverPath =
			this.coverQueue[track.album.embeddedCoverPath];
		if (this.coverQueue[track.album.embeddedCoverPath])
			delete this.coverQueue[track.album.embeddedCoverPath];

		// Save local album art
		if (coverPath) {
			returnData.albumURLs = [];
			this.settings.localArtworkFormat.split(",").forEach((picFormat) => {
				if (["png", "jpg"].includes(picFormat)) {
					let extendedFormat = picFormat;
					if (extendedFormat === "jpg")
						extendedFormat += `-${this.settings.jpegImageQuality}`;
					const url = track.album.pic.getURL(
						this.settings.localArtworkSize,
						extendedFormat
					);
					// Skip non deezer pictures at the wrong format
					if (track.album.pic instanceof StaticPicture && picFormat !== "jpg")
						return;
					returnData.albumURLs.push({ url, ext: picFormat });
				}
			});
			returnData.albumPath = coverPath;
			returnData.albumFilename = generateAlbumName(
				this.settings.coverImageTemplate,
				track.album,
				this.settings,
				track.playlist
			);
		}

		// Save artist art
		if (artistPath) {
			returnData.artistURLs = [];
			this.settings.localArtworkFormat.split(",").forEach((picFormat) => {
				// Deezer doesn't support png artist images
				if (picFormat === "jpg") {
					const extendedFormat = `${picFormat}-${this.settings.jpegImageQuality}`;
					const url = track.album.mainArtist.pic.getURL(
						this.settings.localArtworkSize,
						extendedFormat
					);
					// Skip non deezer pictures at the wrong format
					if (track.album.mainArtist.pic.md5 === "") return;
					returnData.artistURLs.push({ url, ext: picFormat });
				}
			});
			returnData.artistPath = artistPath;
			returnData.artistFilename = generateArtistName(
				this.settings.artistImageTemplate,
				track.album.mainArtist,
				this.settings,
				track.album.rootArtist
			);
		}

		// Save playlist art
		if (track.playlist) {
			if (this.playlistURLs.length === 0) {
				this.settings.localArtworkFormat.split(",").forEach((picFormat) => {
					if (["png", "jpg"].includes(picFormat)) {
						let extendedFormat = picFormat;
						if (extendedFormat === "jpg")
							extendedFormat += `-${this.settings.jpegImageQuality}`;
						const url = track.playlist.pic.getURL(
							this.settings.localArtworkSize,
							extendedFormat
						);
						// Skip non deezer pictures at the wrong format
						if (
							track.playlist.pic instanceof StaticPicture &&
							picFormat !== "jpg"
						)
							return;
						this.playlistURLs.push({ url, ext: picFormat });
					}
				});
			}
			if (!this.playlistCovername) {
				track.playlist.bitrate = track.bitrate;
				track.playlist.dateString = track.playlist.date.format(
					this.settings.dateFormat
				);
				this.playlistCovername = generateAlbumName(
					this.settings.coverImageTemplate,
					track.playlist,
					this.settings,
					track.playlist
				);
			}
		}

		// Save lyrics in lrc file
		if (this.settings.syncedLyrics && track.lyrics.sync) {
			if (
				!existsSync(`${filepath}/${filename}.lrc`) ||
				[OverwriteOption.OVERWRITE, OverwriteOption.ONLY_TAGS].includes(
					this.settings.overwriteFile
				)
			) {
				writeFileSync(`${filepath}/${filename}.lrc`, track.lyrics.sync);
			}
		}

		// Download the track
		track.downloadURL = track.urls[formatsName[track.bitrate]];
		if (!track.downloadURL) throw new DownloadFailed("notAvailable", track);
		try {
			await streamTrack(writepath, track, this.downloadObject, this.listener);
		} catch (e) {
			if (e instanceof HTTPError)
				throw new DownloadFailed("notAvailable", track);
			throw e;
		}

		if (!track.local) {
			tagTrack(extension, writepath, track, this.settings.tags);
		}

		if (track.searched) returnData.searched = true;
		this.downloadObject.downloaded += 1;

		if (this.listener) {
			this.listener.send("updateQueue", {
				uuid: this.downloadObject.uuid,
				downloaded: true,
				downloadPath: String(writepath),
				downloadFolder,
				extrasPath: String(this.downloadObject.extrasPath),
			});
		}
		returnData.filename = writepath.slice(extrasPath.length + 1);
		returnData.data = itemData;
		returnData.path = String(writepath);
		returnData.bitrate = track.bitrate;
		this.downloadObject.files.push(returnData);
		return returnData;
	}


	findExistingCompleteRelease(): { complete: boolean; folder: string } {
		const downloadObject = this.downloadObject;
		if (
			!(downloadObject instanceof Collection) ||
			downloadObject.type !== "album" ||
			[
				OverwriteOption.OVERWRITE,
				OverwriteOption.KEEP_BOTH,
				OverwriteOption.ONLY_TAGS,
			].includes(this.settings.overwriteFile)
		) {
			return { complete: false, folder: "" };
		}

		const albumAPI = downloadObject.collection.albumAPI;
		const extension = extensions[this.bitrate];
		if (!albumAPI || !extension || !downloadObject.collection.tracks.length) {
			return { complete: false, folder: "" };
		}

		let releaseFolder = "";

		try {
			for (const trackAPI of downloadObject.collection.tracks as APITrack[]) {
				const track = new Track();
				track.parseEssentialData(trackAPI as any);
				track.parseTrack(trackAPI);
				track.album = new Album(
					String(albumAPI.id ?? downloadObject.id),
					albumAPI.title ?? downloadObject.title,
					albumAPI.md5_image ?? ""
				);
				track.album.parseAlbum(albumAPI);
				track.position = trackAPI.position;
				if (track.mainArtist && !track.artist.Main.length) {
					track.artist.Main = [track.mainArtist.name];
				}
				if (
					track.mainArtist &&
					!track.artists.includes(track.mainArtist.name)
				) {
					track.artists.push(track.mainArtist.name);
				}
				track.generateMainFeatStrings();
				track.bitrate = this.bitrate as any;
				track.album.bitrate = this.bitrate;
				track.applySettings(this.settings);

				const { filename, filepath, extrasPath } = generatePath(
					track,
					downloadObject.type,
					this.settings
				);
				if (!releaseFolder) releaseFolder = String(extrasPath || filepath);

				const writepath = `${filepath}/${filename}${extension}`;
				if (
					checkShouldDownload(
						filename,
						filepath,
						extension,
						writepath,
						this.settings.overwriteFile,
						track
					)
				) {
					return { complete: false, folder: releaseFolder };
				}
			}
		} catch {
			// If the local-only path calculation is uncertain, fall back to the
			// normal downloader instead of incorrectly skipping a release.
			return { complete: false, folder: releaseFolder };
		}

		return { complete: true, folder: releaseFolder };
	}

	async downloadWrapper(
		extraData: { trackAPI: APITrack; albumAPI?: APIAlbum; playlistAPI?: any },
		track?: Track,
		refetchTrack = true,
		fallbackState: {
			visitedTrackIDs: Set<string>;
			isrcAttempted: boolean;
			isrcSearchAttempted: boolean;
			isrcDeadline?: number;
			isrcAlbumLookups?: number;
			isrcCandidates?: number;
			attempts: number;
			indeterminate?: boolean;
		} = {
			visitedTrackIDs: new Set<string>(),
			isrcAttempted: false,
			isrcSearchAttempted: false,
			attempts: 0,
			indeterminate: false,
		},
		finalizeFailure = true,
		probeOnly = false,
		requireExactBitrate = false,
		probeRoot = false
	) {
		const { trackAPI } = extraData;
		fallbackState.visitedTrackIDs.add(String(track?.id ?? trackAPI.id));

		// Temp metadata to generate logs
		const itemData = {
			id: trackAPI.id,
			title: trackAPI.title,
			artist: trackAPI.artist.name,
		};

		let result;
		try {
			result = await this.download(
				extraData,
				track,
				refetchTrack,
				probeOnly,
				requireExactBitrate
			);
		} catch (e) {
			if (e instanceof DownloadFailed) {
				if (e.track) {
					const failedTrack = e.track;

					if (this.settings.fallbackISRC && failedTrack.ISRC &&
						fallbackState.isrcDeadline === undefined) {
						fallbackState.isrcDeadline = Date.now() + ISRC_FALLBACK_BUDGET_MS;
					}
					const hasISRCTime = () =>
						Date.now() < (fallbackState.isrcDeadline ?? 0);
					const boundedLookup = <T>(
						operation: () => Promise<T>, isISRC: boolean
					) => withFallbackTimeout(
						operation,
						isISRC ? (fallbackState.isrcDeadline ?? Date.now()) :
							Date.now() + METADATA_TIMEOUT_MS,
						METADATA_TIMEOUT_MS
					);

					const tryFallbackID = async (
						fallbackID: number | string,
						solution: "fallback" | "search",
						isISRC = false
					) => {
						const id = String(fallbackID);
						if (
							!id ||
							id === "0" ||
							fallbackState.visitedTrackIDs.has(id) ||
							fallbackState.attempts >= MAX_FALLBACK_ATTEMPTS ||
							(isISRC && (!hasISRCTime() ||
								(fallbackState.isrcCandidates ?? 0) >= ISRC_MAX_CANDIDATES))
						) {
							return null;
						}

						fallbackState.visitedTrackIDs.add(id);
						fallbackState.attempts += 1;
						if (isISRC) fallbackState.isrcCandidates =
							(fallbackState.isrcCandidates ?? 0) + 1;
						try {
							const gwTrack = await boundedLookup(
								() => this.dz.gw.get_track_with_fallback(fallbackID),
								isISRC
							);
							const mappedFallback = map_track(gwTrack);
							const expectedISRC = normalizeISRC(failedTrack.ISRC);
							const fallbackISRC = normalizeISRC(mappedFallback.isrc);
							if (
								expectedISRC &&
								fallbackISRC !== expectedISRC
							) {
								return null;
							}
							failedTrack.parseEssentialData(mappedFallback);
							if (!probeOnly) {
								this.warn(itemData, e.errid, solution);
							}
							if (solution === "search") {
								failedTrack.searched = true;
								if (!probeOnly) this.log(itemData, "searchFallback");
							}
							const fallbackResult = await this.downloadWrapper(
								extraData,
								failedTrack,
								false,
								fallbackState,
								false,
								probeOnly,
								requireExactBitrate
							);
							return fallbackResult;
						} catch {
							if (probeOnly) fallbackState.indeterminate = true;
							return null;
						}
					};

					// First use Deezer's native fallback relationship, but never revisit
					// an ID that has already failed in this fallback chain.
					if (failedTrack.fallbackID !== 0) {
						const fallbackResult = await tryFallbackID(
							failedTrack.fallbackID,
							"fallback"
						);
						if (fallbackResult) return fallbackResult;
					}

					// Resolve the exact ISRC directly before walking alternative albums.
					// Deezer's public API supports the isrc:<ISRC> track identifier.
					if (
						this.settings.fallbackISRC &&
						!fallbackState.isrcAttempted &&
						failedTrack.ISRC
					) {
						fallbackState.isrcAttempted = true;
						const targetISRC = normalizeISRC(failedTrack.ISRC);
						const cachedOrResolvedID = hasISRCTime()
							? await boundedLookup(
								() => resolveISRCTrackID(this.dz, targetISRC),
								true
							).catch(() => null)
							: null;
						if (cachedOrResolvedID) {
							const fallbackResult = await tryFallbackID(
								cachedOrResolvedID,
								"fallback",
								true
							);
							if (fallbackResult) return fallbackResult;
							invalidateCachedISRCTrackID(targetISRC, cachedOrResolvedID);
						}
					}

					// Try every alternative album, not just the last one returned.
					while (
						failedTrack.albumsFallback.length &&
						this.settings.fallbackISRC &&
						hasISRCTime() &&
						(fallbackState.isrcAlbumLookups ?? 0) < ISRC_MAX_ALBUM_LOOKUPS &&
						(fallbackState.isrcCandidates ?? 0) < ISRC_MAX_CANDIDATES &&
						fallbackState.attempts < MAX_FALLBACK_ATTEMPTS
					) {
						const newAlbumID = failedTrack.albumsFallback.pop();
						fallbackState.isrcAlbumLookups =
							(fallbackState.isrcAlbumLookups ?? 0) + 1;
						try {
							const newAlbum = await boundedLookup(
								() => this.dz.gw.get_album_page(newAlbumID), true
							);
							const targetISRC = normalizeISRC(failedTrack.ISRC);
							const alternativeTrack = newAlbum?.SONGS?.data?.find(
								(newTrack) =>
									normalizeISRC(newTrack.ISRC || "") === targetISRC &&
									!fallbackState.visitedTrackIDs.has(String(newTrack.SNG_ID))
							);

							if (!alternativeTrack) continue;
							putCachedISRCTrackID(targetISRC, alternativeTrack.SNG_ID);
							const fallbackResult = await tryFallbackID(
								alternativeTrack.SNG_ID,
								"fallback",
								true
							);
							if (fallbackResult) return fallbackResult;
						} catch {
							if (probeOnly) fallbackState.indeterminate = true;
							/* Try the next alternative album. */
						}
					}

					// If Deezer's direct ISRC lookup points to an unavailable copy,
					// search Deezer and validate candidates by the exact same ISRC.
					if (
						this.settings.fallbackISRC &&
						!fallbackState.isrcSearchAttempted &&
						failedTrack.ISRC &&
						hasISRCTime() &&
						(fallbackState.isrcCandidates ?? 0) < ISRC_MAX_CANDIDATES &&
						fallbackState.attempts < MAX_FALLBACK_ATTEMPTS
					) {
						fallbackState.isrcSearchAttempted = true;
						const targetISRC = normalizeISRC(failedTrack.ISRC);
						const searchQuery = `${failedTrack.mainArtist?.name || ""} ${failedTrack.title || ""}`.trim();

						try {
							let index = 0;
							let pages = 0;
							let total = Number.POSITIVE_INFINITY;
							const pageSize = 100;

							while (
								index < total &&
								pages < ISRC_MAX_SEARCH_PAGES &&
								hasISRCTime() &&
								(fallbackState.isrcCandidates ?? 0) < ISRC_MAX_CANDIDATES &&
								fallbackState.attempts < MAX_FALLBACK_ATTEMPTS
							) {
								pages++;
								const response: any = await boundedLookup(
									() => this.dz.api.search_track(searchQuery, {
										index,
										limit: pageSize,
									}),
									true
								);
								const candidates = Array.isArray(response?.data)
									? response.data
									: [];

								for (const candidate of candidates) {
									if (
										normalizeISRC(candidate?.isrc || "") !== targetISRC ||
										fallbackState.visitedTrackIDs.has(String(candidate?.id))
									) {
										continue;
									}

									const fallbackResult = await tryFallbackID(
										candidate.id,
										"fallback",
										true
									);
									if (fallbackResult) {
										putCachedISRCTrackID(targetISRC, candidate.id);
										return fallbackResult;
									}
								}

								total = Number(response?.total ?? candidates.length);
								if (candidates.length === 0) break;
								index += candidates.length;
							}
						} catch {
							if (probeOnly) fallbackState.indeterminate = true;
							/* Continue to the metadata fallback. */
						}
					}

					if (
						!failedTrack.searched &&
						this.settings.fallbackSearch &&
						fallbackState.attempts < MAX_FALLBACK_ATTEMPTS
					) {
						let searchedID: string | number = "0";
						try {
							searchedID = await boundedLookup(
								() => this.dz.api.get_track_id_from_metadata(
									failedTrack.mainArtist.name,
									failedTrack.title,
									failedTrack.album.title
								), false
							);
						} catch {
							if (probeOnly) fallbackState.indeterminate = true;
						}
						if (searchedID !== "0") {
							const searchResult = await tryFallbackID(searchedID, "search");
							if (searchResult) return searchResult;
						}
					}

					e.errid += "NoAlternative";
					e.message = ErrorMessages[e.errid] || e.message;
				}

				result = {
					error: {
						message: e.message,
						errid: e.errid,
						data: itemData,
						type: "track",
					},
				};
			} else if (e instanceof DownloadCanceled) {
				return;
			} else {
				if (probeOnly) fallbackState.indeterminate = true;
				result = {
					error: {
						message: e.message,
						data: itemData,
						stack: String(e.stack),
						type: "track",
					},
				};
			}
		}

		if (result?.error && !finalizeFailure) {
			if (probeOnly && probeRoot) {
				return {
					probeUnavailable:
						!fallbackState.indeterminate && Boolean(result.error.errid),
					probeIndeterminate:
						Boolean(fallbackState.indeterminate) || !result.error.errid,
				};
			}
			return null;
		}

		if (result?.error) {
			if (
				this.downloadObject instanceof Single ||
				this.downloadObject instanceof Collection
			) {
				this.downloadObject.completeTrackProgress(this.listener);
			}
			this.downloadObject.failed += 1;
			this.downloadObject.errors.push(result.error);
			if (this.listener) {
				const error = result.error;
				this.listener.send("updateQueue", {
					uuid: this.downloadObject.uuid,
					title: this.downloadObject.title,
					failed: true,
					data: error.data,
					error: error.message,
					errid: error.errid || null,
					stack: error.stack || null,
					type: error.type,
				});
			}
		}
		return result;
	}

	async findUnavailableReleaseTracks() {
		const downloadObject = this.downloadObject;
		if (!(downloadObject instanceof Collection)) return [];

		const unavailableTracks: Array<{
			id: string | number;
			title: string;
			artist: string;
			reason?: string;
		}> = [];
		const concurrency = Math.max(
			1,
			Math.min(Number(this.settings.queueConcurrency) || 1, 4)
		);

		await eachLimit(
			downloadObject.collection.tracks,
			concurrency,
			async (trackAPI: APITrack) => {
				// One unreliable track must not stall album preflight indefinitely.
				// Verify every track BEFORE the first file is written.
				let result: any;
				try {
					result = await withFallbackTimeout(
						() => this.downloadWrapper(
							{
								trackAPI,
								albumAPI: downloadObject.collection.albumAPI,
								playlistAPI: downloadObject.collection.playlistAPI,
							},
							undefined,
							true,
							{
								visitedTrackIDs: new Set<string>(),
								isrcAttempted: false,
								isrcSearchAttempted: false,
								attempts: 0,
								indeterminate: false,
							},
							false,
							true,
							true,
							true
						),
						Date.now() + 12000,
						12000
					);
				} catch (error) {
					result = { probeIndeterminate: true, reason: String(error) };
				}

				// Fail closed on timeout, undefined, errors or unverified quality.
				// Only an affirmative exact-format probe permits the album.
				if (result?.probeAvailable !== true || result.bitrate !== this.bitrate) {
					unavailableTracks.push({
						id: trackAPI.id,
						title: trackAPI.title,
						artist: trackAPI.artist?.name || "",
						reason: result?.reason || (result?.probeIndeterminate
							? "Could not verify desired quality"
							: "Desired quality unavailable"),
					});
				}
			}
		);

		return unavailableTracks;
	}

	afterDownloadErrorReport(position, error, itemData = {}) {
		this.downloadObject.errors.push({
			message: error.message,
			stack: String(error.stack),
			data: { position, ...itemData },
			type: "post",
		});
		if (this.listener) {
			this.listener.send("updateQueue", {
				uuid: this.downloadObject.uuid,
				postFailed: true,
				error: error.message,
				data: { position, ...itemData },
				stack: error.stack,
				type: "post",
			});
		}
	}

	async afterDownloadSingle(track: any) {
		if (!track) return;
		if (!this.downloadObject.extrasPath) {
			this.downloadObject.extrasPath = this.settings.downloadLocation;
		}

		// Save local album artwork
		try {
			if (this.settings.saveArtwork && track.albumPath) {
				await each(track.albumURLs, async (image: any) => {
					await downloadImage(
						image.url,
						`${track.albumPath}/${track.albumFilename}.${image.ext}`,
						this.settings.overwriteFile
					);
				});
			}
		} catch (e) {
			this.afterDownloadErrorReport("SaveLocalAlbumArt", e);
		}

		// Save local artist artwork
		try {
			if (this.settings.saveArtworkArtist && track.artistPath) {
				await each(track.artistURLs, async (image: any) => {
					await downloadImage(
						image.url,
						`${track.artistPath}/${track.artistFilename}.${image.ext}`,
						this.settings.overwriteFile
					);
				});
			}
		} catch (e) {
			this.afterDownloadErrorReport("SaveLocalArtistArt", e);
		}

		// Create searched logfile
		try {
			if (this.settings.logSearched && track.searched) {
				const filename = `${track.data.artist} - ${track.data.title}`;
				let searchedFile;
				try {
					searchedFile = readFileSync(
						`${this.downloadObject.extrasPath}/searched.txt`
					).toString();
				} catch {
					searchedFile = "";
				}
				if (searchedFile.indexOf(filename) === -1) {
					if (searchedFile !== "") searchedFile += "\r\n";
					searchedFile += filename + "\r\n";
					writeFileSync(
						`${this.downloadObject.extrasPath}/searched.txt`,
						searchedFile
					);
				}
			}
		} catch (e) {
			this.afterDownloadErrorReport("CreateSearchedLog", e);
		}

		// Execute command after download
		try {
			if (process.env.DEEMIX_ALLOW_POST_DOWNLOAD_COMMANDS === "true" && this.settings.executeCommand !== "") {
				const child = exec(
					this.settings.executeCommand
						.replaceAll("%folder%", shellEscape(this.downloadObject.extrasPath))
						.replaceAll("%filename%", shellEscape(track.filename)),
					(error, stdout, stderr) => {
						if (error) this.afterDownloadErrorReport("ExecuteCommand", error);
						const itemData = { stderr, stdout };
						if (stderr) this.log(itemData, "stderr");
						if (stdout) this.log(itemData, "stdout");
					}
				);

				await new Promise((resolve) => {
					child.on("close", resolve);
				});
			}
		} catch (e) {
			this.afterDownloadErrorReport("ExecuteCommand", e);
		}
	}

	async afterDownloadCollection(tracks) {
		if (!this.downloadObject.extrasPath) {
			this.downloadObject.extrasPath = this.settings.downloadLocation;
		}

		const playlist = [];
		let errors = "";
		let searched = "";

		for (let i = 0; i < tracks.length; i++) {
			const track = tracks[i];
			if (!track) {
				playlist[i] = "";
				continue;
			}

			if (track.error) {
				if (!track.error.data)
					track.error.data = { id: "0", title: "Unknown", artist: "Unknown" };
				errors += `${track.error.data.id} | ${track.error.data.artist} - ${track.error.data.title} | ${track.error.message}\r\n`;
			}

			if (track.searched)
				searched += `${track.data.artist} - ${track.data.title}\r\n`;

			// Save local album artwork
			try {
				if (this.settings.saveArtwork && track.albumPath) {
					await each(track.albumURLs, async (image: any) => {
						await downloadImage(
							image.url,
							`${track.albumPath}/${track.albumFilename}.${image.ext}`,
							this.settings.overwriteFile
						);
					});
				}
			} catch (e) {
				this.afterDownloadErrorReport("SaveLocalAlbumArt", e, track.data);
			}

			// Save local artist artwork
			try {
				if (this.settings.saveArtworkArtist && track.artistPath) {
					await each(track.artistURLs, async (image: any) => {
						await downloadImage(
							image.url,
							`${track.artistPath}/${track.artistFilename}.${image.ext}`,
							this.settings.overwriteFile
						);
					});
				}
			} catch (e) {
				this.afterDownloadErrorReport("SaveLocalArtistArt", e, track.data);
			}

			// Save filename for playlist file
			playlist[i] = track.filename || "";
		}

		// Create errors logfile
		try {
			if (this.settings.logErrors && errors !== "") {
				writeFileSync(`${this.downloadObject.extrasPath}/errors.txt`, errors);
			}
		} catch (e) {
			this.afterDownloadErrorReport("CreateErrorLog", e);
		}

		// Create searched logfile
		try {
			if (this.settings.logSearched && searched !== "") {
				writeFileSync(
					`${this.downloadObject.extrasPath}/searched.txt`,
					searched
				);
			}
		} catch (e) {
			this.afterDownloadErrorReport("CreateSearchedLog", e);
		}

		// Save Playlist Artwork
		try {
			if (
				this.settings.saveArtwork &&
				this.playlistCovername &&
				!this.settings.tags.savePlaylistAsCompilation
			) {
				await each(this.playlistURLs, async (image) => {
					await downloadImage(
						image.url,
						`${this.downloadObject.extrasPath}/${this.playlistCovername}.${image.ext}`,
						this.settings.overwriteFile
					);
				});
			}
		} catch (e) {
			this.afterDownloadErrorReport("SavePlaylistArt", e);
		}

		// Create M3U8 File
		try {
			if (this.settings.createM3U8File) {
				const filename =
					generateDownloadObjectName(
						this.settings.playlistFilenameTemplate,
						this.downloadObject,
						this.settings
					) || "playlist";
				writeFileSync(
					`${this.downloadObject.extrasPath}/${filename}.m3u8`,
					playlist.join("\n")
				);
			}
		} catch (e) {
			this.afterDownloadErrorReport("CreatePlaylistFile", e);
		}

		// Execute command after download
		try {
			if (process.env.DEEMIX_ALLOW_POST_DOWNLOAD_COMMANDS === "true" && this.settings.executeCommand !== "") {
				const child = exec(
					this.settings.executeCommand
						.replaceAll("%folder%", shellEscape(this.downloadObject.extrasPath))
						.replaceAll("%filename%", ""),
					(error, stdout, stderr) => {
						if (error) this.afterDownloadErrorReport("ExecuteCommand", error);
						const itemData = { stderr, stdout };
						if (stderr) this.log(itemData, "stderr");
						if (stdout) this.log(itemData, "stdout");
					}
				);

				await new Promise((resolve) => {
					child.on("close", resolve);
				});
			}
		} catch (e) {
			this.afterDownloadErrorReport("ExecuteCommand", e);
		}
	}
}
