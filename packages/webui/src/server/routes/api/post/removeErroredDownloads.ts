import type { ApiHandler } from "../../../types.js";
const path = "/removeErroredDownloads";
const handler: ApiHandler["handler"] = (req, res) => {
	const deemix = req.app.get("deemix");
	res.send({ result: true, removed: deemix.removeErroredDownloads() });
};
export default { path, handler };
