import { normalizeName } from '../src/recommend/normalize.ts'

const SITE = 'https://www.festivaldust.com'
const TTL_MS = 24 * 60 * 60 * 1000
const USER_AGENT = 'DeepCut/0.1 (personal non-commercial project)'
const SLUG_PATTERN = /^[a-z0-9-]{3,100}$/

export interface FestivalSummary {
  slug: string
  name: string
  year: number
}

export interface FestivalLineup {
  slug: string
  name: string
  dateEnd: string | null
  artists: { name: string; likes: number }[]
}

export class FestivalError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

interface Cached<T> {
  value: T
  expires: number
}

let indexCache: Cached<FestivalSummary[]> | null = null
const lineupCache = new Map<string, Cached<FestivalLineup>>()

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new FestivalError(`Festival source returned ${res.status}`, res.status === 404 ? 404 : 502)
  return res.text()
}

// Slugs look like "electric-forest-2026-rothburymi": name words, year, then location.
export function parseSlug(slug: string): FestivalSummary | null {
  const match = slug.match(/^(.+?)-((?:19|20)\d{2})(?:-|$)/)
  if (!match) return null
  const name = match[1]
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
  return { slug, name, year: Number(match[2]) }
}

export function parseSitemap(xml: string): FestivalSummary[] {
  const out: FestivalSummary[] = []
  for (const m of xml.matchAll(/\/festivals\/([a-z0-9-]+)\/lineup</g)) {
    const summary = parseSlug(m[1])
    if (summary) out.push(summary)
  }
  return out
}

async function getIndex(): Promise<FestivalSummary[]> {
  if (indexCache && indexCache.expires > Date.now()) return indexCache.value
  const value = parseSitemap(await fetchText(`${SITE}/sitemap.xml`))
  indexCache = { value, expires: Date.now() + TTL_MS }
  return value
}

export async function searchFestivals(query: string): Promise<FestivalSummary[]> {
  const tokens = normalizeName(query).split(' ').filter(Boolean)
  if (tokens.length === 0) return []
  const index = await getIndex()
  return index
    .filter((f) => {
      const haystack = normalizeName(`${f.name} ${f.year}`)
      return tokens.every((t) => haystack.includes(t))
    })
    .sort((a, b) => b.year - a.year || a.name.localeCompare(b.name))
    .slice(0, 8)
}

// Returns the JSON object text starting at `start` (which must be "{"), respecting strings.
function extractObject(text: string, start: number): string | null {
  let depth = 0
  let inString = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      if (c === '\\') i++
      else if (c === '"') inString = false
    } else if (c === '"') inString = true
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) return text.slice(start, i + 1)
  }
  return null
}

// The page embeds its data as Next.js flight chunks: self.__next_f.push([1,"<json string>"]).
function flightPayload(html: string): string {
  let payload = ''
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) {
    payload += JSON.parse(m[1])
  }
  return payload
}

interface RawSet {
  artistName?: unknown
  likes?: unknown
}

// Festival pages also list yoga, ceremonies, battles and similar programming.
const NON_MUSIC =
  /\b(yoga|ceremony|circles?|auction|battle|talent show|sound bath|journey|pride|workshop|panel|meditation|discovery project|humanity|loops)\b/i

function displayName(raw: string): string {
  const name = raw.trim()
  if (name !== name.toUpperCase() || name.length < 4) return name
  return name.toLowerCase().replace(/(^|[\s'’.-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase())
}

export function parseLineupPage(slug: string, html: string): FestivalLineup {
  const payload = flightPayload(html)
  const start = payload.indexOf('{"festival":{')
  const festivalStart = start === -1 ? -1 : payload.indexOf('{', start + 1)
  const raw = festivalStart === -1 ? null : extractObject(payload, festivalStart)
  if (!raw) throw new FestivalError('Could not read this festival page', 502)
  const festival = JSON.parse(raw) as { name?: string; dateEnd?: string; lineup?: RawSet[] }
  if (!Array.isArray(festival.lineup)) throw new FestivalError('This festival has no lineup yet', 404)

  // The catalog on the page has properly cased names; set entries are often ALL CAPS.
  const catalog = new Map<string, string>()
  for (const m of payload.matchAll(/\{[^{}]*"spotifyId"[^{}]*\}/g)) {
    try {
      const entry = JSON.parse(m[0]) as { name?: unknown }
      if (typeof entry.name === 'string') catalog.set(normalizeName(entry.name), entry.name)
    } catch {
      // skip malformed fragments
    }
  }

  const byName = new Map<string, { name: string; likes: number }>()
  for (const set of festival.lineup) {
    if (typeof set.artistName !== 'string' || !set.artistName.trim()) continue
    if (NON_MUSIC.test(set.artistName)) continue
    const likes = typeof set.likes === 'number' ? set.likes : 0
    for (const part of set.artistName.split(/\s+b2b\s+/i)) {
      const key = normalizeName(part)
      if (!key) continue
      const existing = byName.get(key)
      if (existing) existing.likes = Math.max(existing.likes, likes)
      else byName.set(key, { name: catalog.get(key) ?? displayName(part), likes })
    }
  }

  const summary = parseSlug(slug)
  return {
    slug,
    name: festival.name ? `${festival.name}${summary ? ` ${summary.year}` : ''}` : (summary?.name ?? slug),
    dateEnd: festival.dateEnd ?? null,
    artists: [...byName.values()],
  }
}

export async function getFestivalLineup(slug: string): Promise<FestivalLineup> {
  if (!SLUG_PATTERN.test(slug)) throw new FestivalError('Invalid festival', 400)
  const cached = lineupCache.get(slug)
  if (cached && cached.expires > Date.now()) return cached.value
  const index = await getIndex()
  if (!index.some((f) => f.slug === slug)) throw new FestivalError('Festival not found', 404)
  const value = parseLineupPage(slug, await fetchText(`${SITE}/festivals/${slug}/lineup`))
  lineupCache.set(slug, { value, expires: Date.now() + TTL_MS })
  return value
}
