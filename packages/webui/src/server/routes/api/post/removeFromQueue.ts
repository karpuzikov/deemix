import { type ApiHandler } from "../../../types.js";

const path = "/removeFromQueue";

const handler: ApiHandler["handler"] = (req, res) => {
	const deemix = req.app.get("deemix");
	const uuid = typeof req.body?.uuid === "string"
		? req.body.uuid
		: String(req.query.uuid ?? "");
	if (uuid) {
		deemix.cancelDownload(uuid);
		res.send({ result: true });
	} else {
		res.send({ result: false });
	}
};

const apiHandler = { path, handler };

export default apiHandler;
