import type { ApiHandler } from "../../../types.js";
const path = "/pauseQueue";
const handler: ApiHandler["handler"] = (req, res) => {
	const deemix = req.app.get("deemix");
	deemix.pauseQueue(req.body?.stop === true);
	res.send({ result: true, queuePaused: true });
};
export default { path, handler };
