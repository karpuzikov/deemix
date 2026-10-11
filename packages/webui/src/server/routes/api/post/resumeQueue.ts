import { Deezer } from "deezer-sdk";
import { sessionDZ } from "../../../deemixApp.js";
import type { ApiHandler } from "../../../types.js";
const path = "/resumeQueue";
const handler: ApiHandler["handler"] = (req, res) => {
	const dz = sessionDZ[req.session.id];
	if (!dz?.loggedIn) {
		res.status(401).send({ result: false, error: "Log in to resume downloads" });
		return;
	}
	const deemix = req.app.get("deemix");
	deemix.resumeQueue(dz as Deezer);
	res.send({ result: true, queuePaused: false });
};
export default { path, handler };
