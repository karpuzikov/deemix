import { type ApiHandler } from "../../../types.js";
const apiHandler: ApiHandler = {
	path: "/stopQueue",
	handler: (req, res) => {
		const deemix = req.app.get("deemix");
		deemix.stopQueue();
		res.send({ result: true, paused: true, stopping: true });
	},
};
export default apiHandler;
