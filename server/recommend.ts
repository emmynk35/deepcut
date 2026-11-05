import { getInfo, getSimilar, LastFmError } from './lastfm.ts'
import { rankArtists, type LineupArtist, type SimilarArtist, type TasteArtist } from '../src/recommend/score.ts'

interface FestivalArtist {
  name: string
  likes: number
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

// Not-found acts are skipped so they are never recommended.
async function enrich(apiKey: string, artists: FestivalArtist[]): Promise<LineupArtist[]> {
  const rows = await mapLimit(artists, async (a) => {
    try {
      const [info, similar] = await Promise.all([getInfo(apiKey, a.name), getSimilar(apiKey, a.name)])
      return { name: a.name, likes: a.likes, listeners: info.listeners, similar }
    } catch (err) {
      if (err instanceof LastFmError && err.status === 404) return null
      throw err
    }
  })
  return rows.filter((r): r is LineupArtist => r !== null)
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
) {
  const [lineup, userSimilar] = await Promise.all([enrich(apiKey, festivalArtists), neighbors(apiKey, taste)])
  return rankArtists(lineup, taste, { familiar, userSimilar, limit })
}
