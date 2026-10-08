
import {
	Deezer,
	utils,
	type APIAlbum,
	type EnrichedAPIAlbum,
	type GWTrack,
} from "deezer-sdk";
import { GenerationError, InvalidID } from "../errors.js";
import { Collection } from "./Collection.js";
import { generateTrackItem } from "./generateTrackItem.js";

const { mapGwTrackToDeezer: map_track, map_album } = utils;

const EXACT_RELEASE_FIELDS = [
	"id",
	"title",
	"title_short",
	"title_version",
	"artist",
	"upc",
	"label",
	"release_date",
	"original_release_date",
	"physical_release_date",
	"digital_release_date",
	"record_type",
	"nb_tracks",
	"nb_disk",
	"copyright",
	"md5_image",
	"cover",
	"cover_small",
	"cover_medium",
	"cover_big",
	"cover_xl",
	"explicit_lyrics",
	"explicit_content_lyrics",
	"explicit_content_cover",
] as const;

export function mergeExactReleaseMetadata(
	baseAlbum: any,
	exactAlbum: any,
	requestedID: string
) {
	if (!exactAlbum || String(exactAlbum.id ?? "") !== String(requestedID)) {
		return baseAlbum;
	}

	const merged = { ...baseAlbum };
	for (const field of EXACT_RELEASE_FIELDS) {
		const value = exactAlbum[field];
		if (value === undefined || value === null || value === "") continue;
		merged[field] = value;
	}

	if (
		Array.isArray(exactAlbum.contributors) &&
		exactAlbum.contributors.length
	) {
		merged.contributors = exactAlbum.contributors;
	}

	return merged;
}

export async function generateAlbumItem(
	dz: Deezer,
	id: string,
	bitrate: number,
	rootArtist?: { id: any; name: any; picture_small: any }
) {
	// The requested Deezer release is the metadata authority. Gateway calls may
	// transparently resolve to another playable release; that fallback must never
	// replace the requested album title, artist, barcode, or track listing.
	let albumAPI: APIAlbum | EnrichedAPIAlbum;
	let exactPageTracks: any[] = [];
	if (String(id).startsWith("upc")) {
		const rawUpc = id.slice(4);
		const upcs = Array.from(new Set([rawUpc, rawUpc.replace(/^0+(?=\d)/, "")]));
		let lastError: unknown;
		for (const upc of upcs) {
			try {
				albumAPI = await dz.api.get_album(`upc:${upc}`);
				if (albumAPI?.id) break;
			} catch (error) {
				lastError = error;
			}
		}
		if (!albumAPI?.id) {
			throw new GenerationError(
				`https://deezer.com/album/${id}`,
				lastError instanceof Error ? lastError.message : "UPC not found"
			);
		}
		id = albumAPI.id;
	} else {
		try {
			const requestedID = String(id);
			const publicAlbum = await dz.api.get_album(requestedID);
			albumAPI = publicAlbum;

			try {
				const albumAPI_gw_page = await dz.gw.get_album_page(requestedID);
				if (
					albumAPI_gw_page.DATA &&
					String(albumAPI_gw_page.DATA.ALB_ID) === requestedID
				) {
					const exactAlbum = <any>map_album(albumAPI_gw_page.DATA);
					albumAPI = mergeExactReleaseMetadata(
						publicAlbum,
						exactAlbum,
						requestedID
					);

					const pageTracks = albumAPI_gw_page?.SONGS?.data;
					if (Array.isArray(pageTracks) && pageTracks.length) {
						exactPageTracks = pageTracks;
					}
				}
			} catch {
				/* Fall back to the public API when exact page metadata is unavailable. */
			}

			id = requestedID;
		} catch (e) {
			throw new GenerationError(`https://deezer.com/album/${id}`, e.message);
		}
	}
	if (!/^\d+$/.test(String(id)))
		throw new InvalidID(`https://deezer.com/album/${id}`);

	// Get extra gateway fields only when the gateway is still describing the
	// exact requested release. A transparent fallback to another album must not
	// contaminate release-level tags.
	try {
		let albumAPI_gw = await dz.gw.get_album(id);
		albumAPI_gw = map_album(albumAPI_gw);
		albumAPI = mergeExactReleaseMetadata(
			albumAPI,
			albumAPI_gw,
			String(id)
		);
	} catch {
		/* Keep the exact page/public metadata already collected. */
	}
	albumAPI.root_artist = rootArtist;

	// If the album is a single download as a track
	if (albumAPI.nb_tracks === 1) {
		const exactTrackID = exactPageTracks[0]?.SNG_ID;
		const publicTrackID = albumAPI.tracks?.data?.[0]?.id;
		const trackID = exactTrackID ?? publicTrackID;
		if (trackID) {
			return generateTrackItem(
				dz,
				trackID,
				bitrate,
				albumAPI
			);
		}
		throw new GenerationError(
			`https://deezer.com/album/${id}`,
			"Single has no tracks."
		);
	}

	let tracksArray: any[] = exactPageTracks.length ? exactPageTracks : [];
	try {
		const gwTracks = tracksArray.length ? [] : await dz.gw.get_album_tracks(id);
		const gwMatchesRequestedRelease =
			Array.isArray(gwTracks) &&
			gwTracks.length > 0 &&
			gwTracks.every(
				(track: any) =>
					track?.ALB_ID === undefined ||
					String(track.ALB_ID) === String(id)
			);
		if (gwMatchesRequestedRelease) tracksArray = gwTracks;
	} catch {
		/* Fall through to the public release track list. */
	}

	let tracksAreGateway = tracksArray.length > 0;
	if (!tracksArray.length) {
		try {
			const publicTracks: any = await dz.api.get_album_tracks(Number(id), {
				limit: -1,
			});
			tracksArray = Array.isArray(publicTracks?.data)
				? publicTracks.data
				: Array.isArray(albumAPI.tracks?.data)
					? albumAPI.tracks.data
					: [];
			tracksAreGateway = false;
		} catch {
			tracksArray = Array.isArray(albumAPI.tracks?.data)
				? albumAPI.tracks.data
				: [];
			tracksAreGateway = false;
		}
	}

	let cover: string;
	if (albumAPI.cover_small) {
		cover = albumAPI.cover_small.slice(0, -24) + "/75x75-000000-80-0-0.jpg";
	} else {
		cover = `https://e-cdns-images.dzcdn.net/images/cover/${albumAPI.md5_image}/75x75-000000-80-0-0.jpg`;
	}

	const totalSize = tracksArray.length;
	albumAPI.nb_tracks = totalSize;
	const collection = [];
	tracksArray.forEach((trackAPI: GWTrack | any, pos: number) => {
		const mappedTrack: any = tracksAreGateway ? map_track(trackAPI) : { ...trackAPI };
		delete mappedTrack.track_token;
		mappedTrack.position = pos + 1;
		collection.push(mappedTrack);
	});

	return new Collection({
		type: "album",
		id,
		bitrate,
		title: albumAPI.title,
		artist: albumAPI.artist.name,
		cover,
		explicit: albumAPI.explicit_lyrics,
		size: totalSize,
		collection: {
			tracks: collection,
			albumAPI,
		},
	});
}
