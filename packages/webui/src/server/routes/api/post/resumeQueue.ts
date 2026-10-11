import { Deezer } from "deezer-sdk";
import { sessionDZ } from "../../../deemixApp.js";
import { type ApiHandler } from "../../../types.js";

const apiHandler: ApiHandler = {
	path: "/resumeQueue",
	handler: (req, res) => {
		const deemix = req.app.get("deemix");
		const dz = sessionDZ[req.session.id] ?? new Deezer();
		const resumed = deemix.resumeQueue(dz);
		res.status(resumed ? 200 : 401).send({
			result: resumed,
			paused: !resumed,
			error: resumed ? undefined : "Login to Deezer before resuming downloads",
		});
	},
};

export default apiHandler;
