import { getInfo, getSimilar, LastFmError } from './lastfm.ts'
import { rankArtists, type LineupArtist, type SimilarArtist, type TasteArtist } from '../src/recommend/score.ts'

interface FestivalArtist {
  name: string
  likes?: number
}

const CONCURRENCY = 5

async function mapLimit<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker))
  return results
}

// Not-found acts are skipped so they are never recommended, and reported back instead.
async function enrich(
  apiKey: string,
  artists: FestivalArtist[],
): Promise<{ lineup: LineupArtist[]; unmatched: string[] }> {
  const rows = await mapLimit<FestivalArtist, LineupArtist | null>(artists, async (a) => {
    try {
      const [info, similar] = await Promise.all([getInfo(apiKey, a.name), getSimilar(apiKey, a.name, 100)])
      return { name: a.name, likes: a.likes, listeners: info.listeners, similar }
    } catch (err) {
      if (err instanceof LastFmError && err.status === 404) return null
      throw err
    }
  })
  return {
    lineup: rows.filter((r): r is LineupArtist => r !== null),
    unmatched: artists.filter((_, i) => rows[i] === null).map((a) => a.name),
  }
}

async function neighbors(apiKey: string, taste: TasteArtist[]): Promise<Record<string, SimilarArtist[]>> {
  const entries = await mapLimit(taste, async (t) => {
    try {
      return [t.name, await getSimilar(apiKey, t.name, 100)] as const
    } catch (err) {
      if (err instanceof LastFmError && err.status === 404) return [t.name, []] as const
      throw err
    }
  })
  return Object.fromEntries(entries)
}

export async function recommend(
  apiKey: string,
  festivalArtists: FestivalArtist[],
  taste: TasteArtist[],
  familiar: string[],
  limit: number,
  discovery: number,
) {
  const [{ lineup, unmatched }, userSimilar] = await Promise.all([
    enrich(apiKey, festivalArtists),
    neighbors(apiKey, taste),
  ])
  // 0 = play it safe, 1 = most adventurous; 0.5 matches the default 0.6/0.4 weights.
  const discoveryWeight = 0.2 + 0.4 * discovery
  const recommendations = rankArtists(lineup, taste, {
    familiar,
    userSimilar,
    limit,
    discoveryWeight,
    tasteWeight: 1 - discoveryWeight,
    minDiscovery: 0.15,
  })
  return { recommendations, unmatched }
}
