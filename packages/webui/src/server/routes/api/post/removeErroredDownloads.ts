import { type ApiHandler } from "../../../types.js";

const apiHandler: ApiHandler = {
	path: "/removeErroredDownloads",
	handler: (req, res) => {
		const deemix = req.app.get("deemix");
		const removed: number = deemix.clearErroredDownloads();
		res.send({ result: true, removed });
	},
};

export default apiHandler;
