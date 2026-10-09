import { describe, it } from "vitest";

// Temporary public-metadata probe. This test intentionally has no assertions:
// a blocked public endpoint must not fail the repository build.
// Remove this temporary file after extracting the actual Deezer album differences.
describe("PROBE supplied Deezer album metadata (temporary)", () => {
	it("prints exact public album and tracklist fields for diagnosis", async () => {
		const ids = ["797548811", "797562931", "572346801", "575695931"];
		await Promise.all(ids.map(async id => {
			const lookup = async (endpoint: string) => {
				try {
					const res = await fetch(endpoint, { signal: AbortSignal.timeout(12000) });
					if (!res.ok) return { error: `HTTP ${res.status}` };
					return await res.json() as any;
				} catch (error) {
					return { error: String(error) };
				}
			};
			const [album, trackResponse] = await Promise.all([
				lookup(`https://api.deezer.com/album/${id}`),
				lookup(`https://api.deezer.com/album/${id}/tracks?limit=100`),
			]);
			const tracks = Array.isArray(trackResponse?.data)
				? trackResponse.data : album?.tracks?.data;
			console.info("DEEZE_PROBE", JSON.stringify({
				id, title: album?.title, artist: album?.artist,
				artist_name: album?.artist?.name,
				record_type: album?.record_type, nb_tracks: album?.nb_tracks,
				explicit_lyrics: album?.explicit_lyrics,
				explicit_content_lyrics: album?.explicit_content_lyrics,
				release_date: album?.release_date, upc: album?.upc,
				duration: album?.duration, error: album?.error,
				album_error: album?.error,
				track_error: trackResponse?.error,
				tracks: tracks?.map((track: any) => ({
					id: track?.id, title: track?.title, title_short: track?.title_short,
					explicit_lyrics: track?.explicit_lyrics, duration: track?.duration,
					isrc: track?.isrc, position: track?.track_position,
					disk_number: track?.disk_number,
				})),
			}));
		}));
	}, 65000);
});
