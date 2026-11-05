import { readFile } from 'node:fs/promises'
import { rankArtists, type LineupArtist, type SimilarArtist } from '../src/recommend/score.ts'
import { getSimilar } from '../server/lastfm.ts'

const apiKey = process.env.LASTFM_API_KEY
if (!apiKey) throw new Error('LASTFM_API_KEY is missing')

const read = async (path: string) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'))
const lineupFile = await read('../data/electric-forest-2026.json')
const cache = await read('../data/lastfm-cache.json')

const lineup: LineupArtist[] = lineupFile.artists
  .filter((a: { name: string }) => cache[a.name])
  .map((a: { name: string; likes: number }) => ({
    name: a.name,
    likes: a.likes,
    listeners: cache[a.name].info.listeners,
    similar: cache[a.name].similar,
  }))

const profiles: Record<string, string[]> = {
  'UK club / garage': ['Fred again..', 'Overmono', "Barry Can't Swim", 'Skrillex', 'Four Tet'],
  'Bass / dubstep': ['Subtronics', 'Rezz', 'Zeds Dead', 'Excision', 'Flume'],
  'Melodic / indie dance': ['ODESZA', 'Bonobo', 'Lane 8', 'Disclosure', 'Jamie xx'],
}

for (const [label, artists] of Object.entries(profiles)) {
  const taste = artists.map((name, i) => ({ name, weight: 1 - i * 0.1 }))
  const userSimilar: Record<string, SimilarArtist[]> = {}
  for (const name of artists) userSimilar[name] = await getSimilar(apiKey, name, 100)

  console.log(`\n=== ${label}: ${artists.join(', ')}`)
  for (const r of rankArtists(lineup, taste, { userSimilar })) {
    const why = r.reasons.slice(0, 2).map((x) => `${x.artist} ${x.similarity.toFixed(2)}`).join(', ')
    console.log(
      `${r.score.toFixed(2)}  ${r.name.padEnd(24)} taste ${r.taste.toFixed(2)}  disc ${r.discovery.toFixed(2)}  ← ${why}`,
    )
  }
}
