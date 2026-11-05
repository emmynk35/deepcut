import { readFile, writeFile } from 'node:fs/promises'
import { getInfo, getSimilar, LastFmError } from '../server/lastfm.ts'

const apiKey = process.env.LASTFM_API_KEY
if (!apiKey) throw new Error('LASTFM_API_KEY is missing')

const lineupUrl = new URL('../data/electric-forest-2026.json', import.meta.url)
const outUrl = new URL('../data/lastfm-cache.json', import.meta.url)
const { artists } = JSON.parse(await readFile(lineupUrl, 'utf8')) as { artists: { name: string }[] }

const results: Record<string, unknown> = {}
const misses: string[] = []
const weak: string[] = []

async function enrich(name: string) {
  try {
    const [info, similar] = await Promise.all([getInfo(apiKey!, name), getSimilar(apiKey!, name, 50)])
    results[name] = { info, similar }
    if (similar.length < 5) weak.push(`${name} (${similar.length} similar)`)
  } catch (err) {
    if (err instanceof LastFmError && err.status === 404) misses.push(name)
    else throw err
  }
}

const queue = [...artists]
await Promise.all(
  Array.from({ length: 4 }, async () => {
    for (let a = queue.shift(); a; a = queue.shift()) await enrich(a.name)
  }),
)

await writeFile(outUrl, JSON.stringify(results, null, 2))
const covered = artists.length - misses.length - weak.length
console.log(`Total ${artists.length}, usable ${covered} (${Math.round((covered / artists.length) * 100)}%)`)
console.log('Not found:', misses.sort())
console.log('Few similar:', weak.sort())
