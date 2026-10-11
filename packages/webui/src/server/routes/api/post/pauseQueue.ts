import { type ApiHandler } from "../../../types.js";

const apiHandler: ApiHandler = {
	path: "/pauseQueue",
	handler: (req, res) => {
		const deemix = req.app.get("deemix");
		deemix.pauseQueue();
		res.send({ result: true, paused: true });
	},
};

export default apiHandler;
