import shuffle from 'array-shuffle';
import {inject, injectable} from 'inversify';
import * as spotifyURI from 'spotify-uri';
import SpotifyWebApi from 'spotify-web-api-node';
import {URL} from 'url';
import {TYPES} from '../types.js';
import {QueuedPlaylist} from './player.js';
import ThirdParty from './third-party.js';

export interface SpotifyTrack {
  name: string;
  artist: string;
}

@injectable()
export default class SpotifyAPI {
  private readonly spotify: SpotifyWebApi;

  constructor(@inject(TYPES.ThirdParty) thirdParty: ThirdParty) {
    this.spotify = thirdParty.spotify;
  }

  // ... other methods ...

  async getPlaylist(
    url: string,
    playlistLimit: number,
  ): Promise<[SpotifyTrack[], QueuedPlaylist]> {
    try {
      const uri = spotifyURI.parse(url) as spotifyURI.Playlist;
      let [{body: playlistResponse}, {body: tracksResponse}]
        = await Promise.all([
          this.spotify.getPlaylist(uri.id),
          this.spotify.getPlaylistTracks(uri.id, {limit: 50}),
        ]);

      const items: SpotifyApi.TrackObjectFull[] = tracksResponse.items
        .map(playlistItem => playlistItem.track)
        .filter((track): track is SpotifyApi.TrackObjectFull => track !== null);

      const playlist: QueuedPlaylist = {
        title: playlistResponse.name,
        source: playlistResponse.href,
      };

      while (tracksResponse.next) {
        const nextUrl = new URL(tracksResponse.next);
        const limit = parseInt(nextUrl.searchParams.get('limit') ?? '50', 10);
        const offset = parseInt(nextUrl.searchParams.get('offset') ?? '0', 10);

        ({body: tracksResponse} = await this.spotify.getPlaylistTracks(
          uri.id,
          {limit, offset},
        ));

        items.push(
          ...tracksResponse.items
            .map(playlistItem => playlistItem.track)
            .filter(
              (track): track is SpotifyApi.TrackObjectFull => track !== null,
            ),
        );
      }

      const tracks = this.limitTracks(items, playlistLimit).map(
        this.toSpotifyTrack,
      );

      return [tracks, playlist];
    } catch (error) {
      throw new Error(`Failed to get playlist: ${(error as Error).message}`);
    }
  }

  // ... other methods ...

  private toSpotifyTrack(track: SpotifyApi.TrackObjectFull): SpotifyTrack {
    return {
      name: track.name,
      artist: track.artists[0]?.name ?? 'Unknown Artist',
    };
  }

  private limitTracks(
    tracks: SpotifyApi.TrackObjectFull[],
    limit: number,
  ): SpotifyApi.TrackObjectFull[] {
    return tracks.length > limit ? shuffle(tracks).slice(0, limit) : tracks;
  }
}
