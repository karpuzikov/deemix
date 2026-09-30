import { postToServer } from "@/utils/api-utils";

export function sendAddToQueue(url: string, bitrate?: number) {
	if (!url) throw new Error("No URL given to sendAddToQueue function!");

	postToServer("addToQueue", { url, bitrate });
}

export async function sendAddToQueueWithFolder(
	url: string,
	bitrate?: number
): Promise<boolean> {
	if (!url) throw new Error("No URL given to sendAddToQueueWithFolder function!");
	if (!window.api?.invoke) return false;

	const selectedPath = await window.api.invoke("selectSessionDownloadFolder");
	if (!selectedPath) return false;

	sendAddToQueue(url, bitrate);
	return true;
}

export function aggregateDownloadLinks(releases: { link: string }[]): string {
	const links = releases.map((release) => release.link);

	return links.join(";");
}
