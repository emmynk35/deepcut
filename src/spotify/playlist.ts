import { spotifyPost } from './api.ts'

interface Playlist {
  id: string
  external_urls: { spotify: string }
}

// Dev Mode endpoints: POST /me/playlists and POST /playlists/{id}/items.
export async function createPlaylist(name: string, description: string, uris: string[]): Promise<string> {
  const playlist = await spotifyPost<Playlist>('/me/playlists', { name, description, public: false })
  for (let i = 0; i < uris.length; i += 100) {
    await spotifyPost(`/playlists/${playlist.id}/items`, { uris: uris.slice(i, i + 100) })
  }
  return playlist.external_urls.spotify
}
