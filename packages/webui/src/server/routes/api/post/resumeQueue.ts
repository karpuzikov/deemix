import { Deezer } from "deezer-sdk";
import { type ApiHandler } from "../../../types.js";
import { sessionDZ } from "../../../deemixApp.js";
const handler: ApiHandler["handler"] = (req, res) => {
	const dz: Deezer | undefined = sessionDZ[req.session.id];
	if (!dz?.loggedIn) {
		res.status(401).send({ result: false, error: "Sign in before resuming queued downloads." });
		return;
	}
	const deemix = req.app.get("deemix");
	res.send({ result: true, ...deemix.resumeQueue(dz) });
};
export default { path: "/resumeQueue", handler } satisfies ApiHandler;
