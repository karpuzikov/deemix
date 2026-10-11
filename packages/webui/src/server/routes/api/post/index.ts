import changeAccount from "./changeAccount.js";
import loginArl from "./loginArl.js";
import addToQueue from "./addToQueue.js";
import cancelAllDownloads from "./cancelAllDownloads.js";
import removeFinishedDownloads from "./removeFinishedDownloads.js";
import removeErroredDownloads from "./removeErroredDownloads.js";
import pauseQueue from "./pauseQueue.js";
import resumeQueue from "./resumeQueue.js";
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
	removeFromQueue,
	logout,
	saveSettings,
	retryDownload,
	spotifyLogout,
];
