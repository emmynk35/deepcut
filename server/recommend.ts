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

// Retries once on transient Last.fm failures; "not found" is a normal answer and is not retried.
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof LastFmError && err.status === 404) throw err
    await new Promise((resolve) => setTimeout(resolve, 700))
    return fn()
  }
}

// Acts Last.fm doesn't know (or can't answer for) are skipped so they are never recommended.
async function enrich(
  apiKey: string,
  artists: FestivalArtist[],
): Promise<{ lineup: LineupArtist[]; unmatched: string[] }> {
  const rows = await mapLimit<FestivalArtist, LineupArtist | null>(artists, async (a) => {
    try {
      const [info, similar] = await withRetry(() =>
        Promise.all([getInfo(apiKey, a.name), getSimilar(apiKey, a.name, 100)]),
      )
      return { name: a.name, likes: a.likes, listeners: info.listeners, similar }
    } catch (err) {
      if (!(err instanceof LastFmError && err.status === 404)) console.warn(`Last.fm lookup failed for ${a.name}`)
      return null
    }
  })
  const lineup = rows.filter((r): r is LineupArtist => r !== null)
  if (lineup.length === 0) throw new LastFmError('Last.fm is unavailable right now. Try again shortly.', 502)
  return { lineup, unmatched: artists.filter((_, i) => rows[i] === null).map((a) => a.name) }
}

async function neighbors(apiKey: string, taste: TasteArtist[]): Promise<Record<string, SimilarArtist[]>> {
  const entries = await mapLimit(taste, async (t) => {
    try {
      return [t.name, await withRetry(() => getSimilar(apiKey, t.name, 100))] as const
    } catch {
      return [t.name, []] as const
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
