import fs from "node:fs";
import path from "node:path";
import { type ApiHandler } from "../../../types.js";

const apiHandler: ApiHandler = {
	path: "/setSessionDownloadLocation",
	handler: (req, res) => {
		if (!req.app.get("isSingleUser")) {
			res.status(403).send({ result: false, error: "Desktop-only operation" });
			return;
		}
		const raw = req.body?.folder;
		if (typeof raw !== "string" || !raw.trim()) {
			res.status(400).send({ result: false, error: "Folder is required" });
			return;
		}
		const folder = path.resolve(raw);
		try {
			if (!fs.statSync(folder).isDirectory()) {
				res.status(400).send({ result: false, error: "Must select a directory" });
				return;
			}
		} catch {
			res.status(400).send({ result: false, error: "Directory does not exist" });
			return;
		}
		const deemix = req.app.get("deemix");
		res.send({ result: true, folder: deemix.setSessionDownloadLocation(folder) });
	},
};

export default apiHandler;
