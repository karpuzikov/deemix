import changeAccount from "./changeAccount.js";
import loginArl from "./loginArl.js";
import addToQueue from "./addToQueue.js";
import cancelAllDownloads from "./cancelAllDownloads.js";
import removeFinishedDownloads from "./removeFinishedDownloads.js";
import removeErroredDownloads from "./removeErroredDownloads.js";
import pauseQueue from "./pauseQueue.js";
import resumeQueue from "./resumeQueue.js";
import stopQueue from "./stopQueue.js";
import setSessionDownloadLocation from "./setSessionDownloadLocation.js";
import removeFromQueue from "./removeFromQueue.js";
import logout from "./logout.js";
import saveSettings from "./saveSettings.js";
import retryDownload from "./retryDownload.js";
import spotifyLogout from "./spotifyLogout.js";

export default [
	changeAccount,
	loginArl,
	addToQueue,
	cancelAllDownloads,
	removeFinishedDownloads,
	removeErroredDownloads,
	pauseQueue,
	resumeQueue,
	stopQueue,
	setSessionDownloadLocation,
	removeFromQueue,
	logout,
	saveSettings,
	retryDownload,
	spotifyLogout,
];
