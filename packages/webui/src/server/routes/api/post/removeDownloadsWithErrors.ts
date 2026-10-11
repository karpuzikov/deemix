import { type ApiHandler } from "../../../types.js";
const handler: ApiHandler["handler"] = (req, res) => {
	const deemix = req.app.get("deemix");
	res.send({ result: true, removed: deemix.removeDownloadsWithErrors() });
};
export default { path: "/removeDownloadsWithErrors", handler } satisfies ApiHandler;
