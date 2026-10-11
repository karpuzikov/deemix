import { type ApiHandler } from "../../../types.js";
const handler: ApiHandler["handler"] = (req, res) => {
	const deemix = req.app.get("deemix");
	res.send({ result: true, ...deemix.pauseQueue() });
};
export default { path: "/pauseQueue", handler } satisfies ApiHandler;
