import { normalizeName } from './normalize.ts'

export interface SpotifyTrack {
  uri: string
  name: string
  artists: { name: string }[]
}

export interface PickedTrack {
  uri: string
  name: string
}

// Keeps only tracks credited to the artist, drops repeat titles, and preserves search order.
export function pickTracks(artistName: string, results: SpotifyTrack[], count = 3): PickedTrack[] {
  const wanted = normalizeName(artistName)
  const seen = new Set<string>()
  const picked: PickedTrack[] = []
  for (const track of results) {
    if (!track.artists.some((a) => normalizeName(a.name) === wanted)) continue
    const title = normalizeName(track.name)
    if (seen.has(title)) continue
    seen.add(title)
    picked.push({ uri: track.uri, name: track.name })
    if (picked.length === count) break
  }
  return picked
}
