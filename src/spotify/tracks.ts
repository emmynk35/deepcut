import { spotifyGet } from './api.ts'
import { pickTracks, type PickedTrack, type SpotifyTrack } from '../recommend/pickTracks.ts'

export async function findTracks(artistName: string, count = 3): Promise<PickedTrack[]> {
  const query = encodeURIComponent(`artist:"${artistName}"`)
  const res = await spotifyGet<{ tracks: { items: SpotifyTrack[] } }>(`/search?type=track&limit=10&q=${query}`)
  return pickTracks(artistName, res.tracks.items, count)
}
