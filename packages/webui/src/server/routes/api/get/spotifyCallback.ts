import { type ApiHandler } from "../../../types.js";
import { spotifyRedirectUri } from "../../../helpers/spotifyRedirectUri.js";
const path: ApiHandler["path"] = "/spotifyCallback";
function escapeHtml(value: unknown): string {
	const table: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
	return String(value ?? "").replace(/[&<>"']/g, (char) => table[char]!);
}
const handler: ApiHandler["handler"] = async (req, res) => {
	const deemix = req.app.get("deemix");
	const spotify = deemix.plugins.spotify;
	const { code, state, error } = req.query;
	if (error) {
		res.status(400).send(`<html><body><h2>Spotify Auth Error</h2><p>${escapeHtml(error)}</p><script>setTimeout(()=>window.close(),3000)</script></body></html>`);
		return;
	}
	if (typeof code !== "string" || typeof state !== "string" || !code || !state) {
		res.status(400).send("<html><body><h2>Missing parameters</h2><script>setTimeout(()=>window.close(),3000)</script></body></html>");
		return;
	}
	const redirectUri = spotifyRedirectUri(req);
	try {
		await spotify.handleAuthCallback(code, redirectUri, state);
		res.send("<html><body><h2>Spotify Connected!</h2><p>You can close this window.</p><script>if(window.opener){window.opener.postMessage('spotifyOAuthSuccess',window.location.origin);setTimeout(()=>window.close(),1500)}else{setTimeout(()=>{window.location.href='/'},1500)}</script></body></html>");
	} catch (error) {
		res.status(500).send(`<html><body><h2>Auth Failed</h2><p>${escapeHtml(error instanceof Error ? error.message : "Unknown OAuth error")}</p><script>setTimeout(()=>window.close(),5000)</script></body></html>`);
	}
};
export default { path, handler };
