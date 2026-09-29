import { eachLimit } from "async";
import {
	type Deezer,
	type APIPlaylist,
	type GWTrack,
	type APIArtist,
	utils,
} from "deezer-sdk";
import {
	InvalidID,
	GenerationError,
	NotYourPrivatePlaylist,
} from "../errors.js";
import { generateAlbumItem } from "./generateAlbumItem.js";
import { Collection } from "./Collection.js";
import {
	getReleaseEditionKey,
	getReleaseFamilyTitle,
	isReleaseVariantTitle,
	isSameReleaseArtist,
	normalizeReleaseTitle,
} from "./releaseVariants.js";
import type { Single } from "./Single.js";

const { map_user_playlist, mapGwTrackToDeezer: map_track } = utils;

export async function generatePlaylistItem(
	dz: Deezer,
	id: string,
	bitrate: number,
	playlistAPI?: APIPlaylist,
	playlistTracksAPI?: any[]
) {
	if (!playlistAPI) {
		if (!/^\d+$/.test(id))
			throw new InvalidID(`https://deezer.com/playlist/${id}`);
		// Get essential playlist info
		try {
			playlistAPI = await dz.api.get_playlist(id);
		} catch (e) {
			console.trace(e);
			playlistAPI = null;
		}
		// Fallback to gw api if the playlist is private
		if (!playlistAPI) {
			try {
				const userPlaylist = await dz.gw.get_playlist_page(id);
				playlistAPI = map_user_playlist(userPlaylist.DATA);
			} catch (e) {
				console.trace(e);
				throw new GenerationError(
					`https://deezer.com/playlist/${id}`,
					e.message
				);
			}
		}
		// Check if private playlist and owner
		if (!playlistAPI.public && playlistAPI.creator.id !== dz.currentUser.id) {
			throw new NotYourPrivatePlaylist(`https://deezer.com/playlist/${id}`);
		}
	}

	if (!playlistTracksAPI) {
		playlistTracksAPI = await dz.gw.get_playlist_tracks(id);
	}
	playlistAPI.various_artist = await dz.api.get_artist(5080); // Useful for save as compilation

	const totalSize = playlistTracksAPI.length;
	playlistAPI.nb_tracks = totalSize;
	const collection = [];
	playlistTracksAPI.forEach((trackAPI: GWTrack, pos: number) => {
		const mappedTrack = map_track(trackAPI);
		if (mappedTrack.explicit_lyrics) {
			playlistAPI.explicit = true;
		}
		delete mappedTrack.track_token;
		mappedTrack.position = pos + 1;
		collection.push(mappedTrack);
	});

	if (!playlistAPI.explicit) playlistAPI.explicit = false;

	return new Collection({
		type: "playlist",
		id,
		bitrate,
		title: playlistAPI.title,
		artist: playlistAPI.creator.name,
		cover: playlistAPI.picture_small.slice(0, -24) + "/75x75-000000-80-0-0.jpg",
		explicit: playlistAPI.explicit,
		size: totalSize,
		collection: {
			tracks: collection,
			playlistAPI,
		},
	});
}

export async function generateArtistItem(
	dz: Deezer,
	id: string,
	bitrate: number,
	listener: {
		send: (
			arg0: string,
			arg1: { id: any; name: any; picture_small: any }
		) => void;
	},
	tab = "all"
) {
	let path = "";
	if (tab !== "all") path = "/" + tab;

	if (!/^\d+$/.test(id))
		throw new InvalidID(`https://deezer.com/artist/${id}`);

	let artistAPI: Partial<APIArtist>;
	try {
		artistAPI = await dz.api.get_artist(id);
	} catch (e) {
		console.trace(e);
		throw new GenerationError(
			`https://deezer.com/artist/${id}${path}`,
			e.message
		);
	}

	const rootArtist = {
		id: artistAPI.id,
		name: artistAPI.name,
		picture_small: artistAPI.picture_small,
	};

	if (listener) listener.send("startAddingArtist", rootArtist);

	const artistDiscographyAPI = await dz.gw.get_artist_discography_tabs(id, {
		limit: 100,
	});

	const candidateAlbums = new Map<string, any>();
	const addCandidate = (album: any) => {
		const albumID = album?.id ?? album?.ALB_ID;
		if (albumID === undefined || albumID === null) return;
		candidateAlbums.set(String(albumID), album);
	};

	if (tab === "discography") {
		// Preserve deemix's existing discography coverage while removing duplicate
		// album IDs that can appear in multiple Deezer tabs.
		Object.entries(artistDiscographyAPI).forEach(([key, releases]: any) => {
			if (key === "all" || !Array.isArray(releases)) return;
			releases.forEach(addCandidate);
		});

		// Deezer's public artist-albums endpoint sometimes contains releases that
		// the gateway discography view hides.
		try {
			const pageSize = 100;
			let index = 0;
			let total = Number.POSITIVE_INFINITY;
			while (index < total && index < 5000) {
				const response: any = await dz.api.get_artist_albums(id, {
					index,
					limit: pageSize,
				});
				const data = Array.isArray(response?.data) ? response.data : [];
				data.forEach(addCandidate);
				total = Number(response?.total ?? data.length);
				if (data.length === 0) break;
				index += data.length;
			}
		} catch (e) {
			console.warn("Could not expand artist albums through public API", e);
		}

		// Artist pages can still collapse several editions into one canonical
		// release. Search every distinct release family and add exact artist/title
		// variants such as Deluxe, Décennie, Version intégrale, etc.
		const familySeeds = new Map<string, string>();
		for (const album of candidateAlbums.values()) {
			const title = String(album?.title ?? album?.ALB_TITLE ?? "").trim();
			if (!title) continue;
			const familyTitle = getReleaseFamilyTitle(title);
			const familyKey = normalizeReleaseTitle(familyTitle);
			if (familyKey && !familySeeds.has(familyKey)) {
				familySeeds.set(familyKey, familyTitle);
			}
		}

		await eachLimit(
			Array.from(familySeeds.values()),
			4,
			async (familyTitle: string) => {
				try {
					const pageSize = 100;
					let index = 0;
					let total = Number.POSITIVE_INFINITY;
					const query = `${rootArtist.name ?? ""} ${familyTitle}`.trim();

					while (index < total && index < 1000) {
						const response: any = await dz.api.search_album(query, {
							index,
							limit: pageSize,
						});
						const data = Array.isArray(response?.data) ? response.data : [];

						for (const candidate of data) {
							if (
								isSameReleaseArtist(rootArtist, candidate?.artist) &&
								isReleaseVariantTitle(familyTitle, candidate?.title ?? "")
							) {
								addCandidate(candidate);
							}
						}

						total = Number(response?.total ?? data.length);
						if (data.length === 0) break;
						index += data.length;
					}
				} catch (e) {
					console.warn(
						`Could not search release variants for "${familyTitle}"`,
						e
					);
				}
			}
		);
	} else {
		const tabReleases = artistDiscographyAPI[tab] || [];
		tabReleases.forEach(addCandidate);
	}

	const albumList: (Single | Collection)[] = [];
	const editionKeys = new Set<string>();

	await eachLimit(
		Array.from(candidateAlbums.values()),
		6,
		async (album: any) => {
			const albumID = String(album?.id ?? album?.ALB_ID ?? "");
			if (!albumID) return;

			try {
				const albumData = await generateAlbumItem(
					dz,
					albumID,
					bitrate,
					rootArtist
				);

				// Multiple Deezer IDs may point to the same real edition. Keep
				// different UPCs, but collapse duplicate IDs/territorial mirrors of
				// the same edition. If UPC is unavailable, compare the track ISRC list.
				const editionKey = getReleaseEditionKey(albumData);
				if (!editionKeys.has(editionKey)) {
					editionKeys.add(editionKey);
					albumList.push(albumData);
				}
			} catch (e) {
				console.warn(albumID, "No Data", e);
			}
		}
	);

	if (listener) listener.send("finishAddingArtist", rootArtist);
	return albumList;
}
