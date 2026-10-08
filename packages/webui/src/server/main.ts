import { DeemixApp } from "@/deemixApp.js";
import { logger, removeOldLogs } from "@/helpers/logger.js";
import { loadLoginCredentials } from "@/helpers/loginStorage.js";
import cookieParser from "cookie-parser";
import { randomBytes } from "crypto";
import { createRemoteAccess, isAllowedLocalHost, isAllowedOrigin, isLoopbackHost } from "./security.js";
import { utils, type Listener } from "deemix";
import express, { type Express } from "express";
import session from "express-session";
import memorystore from "memorystore";
import morgan from "morgan";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import ViteExpress from "vite-express";
import { WebSocket, WebSocketServer } from "ws";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { normalizePort } from "./helpers/port.js";
import { getErrorCb, getListeningCb } from "./helpers/server-callbacks.js";
import { registerApis } from "./routes/api/register.js";
import indexRouter from "./routes/index.js";
import type { Arguments } from "./types.js";
import { registerWebsocket } from "./websocket/index.js";

const MemoryStore = memorystore(session);

// TODO: Remove type assertion while keeping correct types
const argv = yargs(hideBin(process.argv)).options({
	port: { type: "string", default: "6595" },
	host: { type: "string", default: "127.0.0.1" },
	locationbase: { type: "string", default: "/" },
	singleuser: { type: "boolean", default: false },
}).argv as Arguments;

const serverPort = process.env.DEEMIX_SERVER_PORT ?? argv.port;
const deemixHost = process.env.DEEMIX_HOST ?? argv.host;
const remoteMode = !isLoopbackHost(deemixHost);
const remoteAccess = remoteMode ? createRemoteAccess(process.env.DEEMIX_ACCESS_TOKEN ?? "") : null;
const isSingleUser =
	process.env.DEEMIX_SINGLE_USER === undefined
		? !!argv.singleuser
		: process.env.DEEMIX_SINGLE_USER === "true";

const app: Express = express();

// Default to loopback. On LAN/public binds every HTTP/WS request must be
// authenticated; a short-lived HttpOnly cookie lets browsers open WebSockets.
app.use((req, res, next) => {
	if (!isAllowedOrigin(req.headers) || (!remoteMode && !isAllowedLocalHost(req.headers))) {
		res.status(403).send("Request origin or host is not permitted.");
		return;
	}
	if (remoteAccess && !remoteAccess.isAuthorized(req)) {
		res.setHeader("WWW-Authenticate", 'Basic realm="Deemix", charset="UTF-8"');
		res.status(401).send("Authentication required.");
		return;
	}
	if (remoteAccess) {
		res.cookie(remoteAccess.cookieName, remoteAccess.cookieValue, {
			httpOnly: true, sameSite: "strict",
			secure: process.env.DEEMIX_COOKIE_SECURE === "true",
			maxAge: remoteAccess.cookieLifetimeMs,
		});
	}
	next();
});

if (isSingleUser) loadLoginCredentials();

app.set("isSingleUser", isSingleUser);

/* === Deemix App === */
const listener: Listener = {
	send: (key: string, data?: any) => {
		const logLine = utils.formatListener(key, data);
		if (logLine) logger.info(logLine);
		if (["downloadInfo", "downloadWarn"].includes(key)) return;
		wss.clients.forEach((client) => {
			if (client.readyState === WebSocket.OPEN) {
				client.send(JSON.stringify({ key, data }));
			}
		});
	},
};
const deemixApp = new DeemixApp(listener);

/* === Middlewares === */
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(
	// @ts-expect-error
	session({
		store: new MemoryStore({
			checkPeriod: 86400000, // prune expired entries every 24h
		}),
		secret:
			process.env.DEEMIX_SESSION_SECRET ?? randomBytes(32).toString("hex"),
		resave: false,
		saveUninitialized: false,
		cookie: { httpOnly: true, sameSite: "strict", secure: process.env.DEEMIX_COOKIE_SECURE === "true" },
	})
);

if (process.env.NODE_ENV === "development") {
	app.use(morgan("dev"));
}

/* === Routes === */
app.use("/", indexRouter);

/* === APIs === */
registerApis(app);

/* === Config === */
app.set("port", serverPort);
app.set("deemix", deemixApp);

/* === Server port === */
const server = app.listen({
	port: normalizePort(serverPort),
	host: deemixHost,
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });
server.on("upgrade", (request, socket, head) => {
	if (!isAllowedOrigin(request.headers) ||
		(!remoteMode && !isAllowedLocalHost(request.headers)) ||
		(remoteAccess && !remoteAccess.isAuthorized(request))) {
		socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
		socket.destroy();
		return;
	}
	wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, request));
});

if (process.env.NODE_ENV === "production") {
	const publicPath = join(dirname(fileURLToPath(import.meta.url)), "public");
	app.use(express.static(publicPath));
	app.get("*", (_, res) => {
		res.sendFile(join(publicPath, "index.html"));
	});
} else {
	ViteExpress.bind(app, server);
}

/* === Server callbacks === */
server.on("error", getErrorCb(serverPort));
server.on("listening", getListeningCb(server));
registerWebsocket(wss, deemixApp);

/* === Remove Old logs files === */
removeOldLogs(5);

export { app, deemixApp, server };
