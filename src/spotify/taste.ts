import { spotifyGet } from './api.ts'
import { buildProfile, type TasteProfile } from './profile.ts'

interface NamedArtist {
  name: string
}
interface Page<T> {
  items: T[]
  next: string | null
  total: number
}
interface Track {
  artists: NamedArtist[]
}

const SAVED_CONCURRENCY = 4

// Saved and recent tracks list artists per track; count each artist by frequency.
function artistsByFrequency(tracks: Track[]): string[] {
  const counts = new Map<string, number>()
  for (const track of tracks) {
    for (const artist of track.artists) counts.set(artist.name, (counts.get(artist.name) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name)
}

async function topArtists(range: 'short_term' | 'medium_term' | 'long_term'): Promise<string[]> {
  const page = await spotifyGet<Page<NamedArtist>>(`/me/top/artists?time_range=${range}&limit=50`)
  return page.items.map((a) => a.name)
}

async function savedTracks(): Promise<Track[]> {
  const first = await spotifyGet<Page<{ track: Track }>>('/me/tracks?limit=50&offset=0')
  const tracks = first.items.map((item) => item.track)
  const offsets: number[] = []
  for (let offset = 50; offset < first.total; offset += 50) offsets.push(offset)
  let next = 0
  const worker = async () => {
    while (next < offsets.length) {
      const offset = offsets[next++]
      const page = await spotifyGet<Page<{ track: Track }>>(`/me/tracks?limit=50&offset=${offset}`)
      tracks.push(...page.items.map((item) => item.track))
    }
  }
  await Promise.all(Array.from({ length: SAVED_CONCURRENCY }, worker))
  return tracks
}

export async function fetchTasteProfile(): Promise<TasteProfile> {
  const [short, medium, long, followed, saved, recent] = await Promise.all([
    topArtists('short_term'),
    topArtists('medium_term'),
    topArtists('long_term'),
    spotifyGet<{ artists: Page<NamedArtist> }>('/me/following?type=artist&limit=50'),
    savedTracks(),
    spotifyGet<Page<{ track: Track }>>('/me/player/recently-played?limit=50'),
  ])
  return buildProfile([
    { source: 'top-short', artists: short },
    { source: 'top-medium', artists: medium },
    { source: 'top-long', artists: long },
    { source: 'followed', artists: followed.artists.items.map((a) => a.name) },
    { source: 'saved', artists: artistsByFrequency(saved) },
    { source: 'recent', artists: artistsByFrequency(recent.items.map((i) => i.track)) },
  ])
}
