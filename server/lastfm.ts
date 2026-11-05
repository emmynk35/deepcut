const BASE_URL = 'https://ws.audioscrobbler.com/2.0/'
const TTL_MS = 24 * 60 * 60 * 1000

export interface SimilarArtist {
  name: string
  match: number
}

export interface ArtistInfo {
  name: string
  listeners: number
  playcount: number
  tags: string[]
}

export class LastFmError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const cache = new Map<string, { expires: number; value: unknown }>()

async function call<T>(
  apiKey: string,
  method: string,
  params: Record<string, string>,
  parse: (body: any) => T,
): Promise<T> {
  const url = new URL(BASE_URL)
  const query = { method, api_key: apiKey, format: 'json', autocorrect: '1', ...params }
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)

  const cacheKey = `${method}:${params.artist?.toLowerCase()}:${params.limit ?? ''}`
  const hit = cache.get(cacheKey)
  if (hit && hit.expires > Date.now()) return hit.value as T

  const res = await fetch(url)
  const body: any = await res.json().catch(() => ({}))
  if (!res.ok || body.error) {
    // error 6 = artist not found
    const status = body.error === 6 ? 404 : 502
    throw new LastFmError(body.message ?? `Last.fm request failed (${res.status})`, status)
  }
  const value = parse(body)
  cache.set(cacheKey, { expires: Date.now() + TTL_MS, value })
  return value
}

export function getSimilar(apiKey: string, artist: string, limit = 30) {
  return call<SimilarArtist[]>(
    apiKey,
    'artist.getsimilar',
    { artist, limit: String(limit) },
    (b) =>
      (b.similarartists?.artist ?? []).map((a: any) => ({
        name: a.name,
        match: Number(a.match),
      })),
  )
}

export function getInfo(apiKey: string, artist: string) {
  return call<ArtistInfo>(apiKey, 'artist.getinfo', { artist }, (b) => ({
    name: b.artist.name,
    listeners: Number(b.artist.stats?.listeners ?? 0),
    playcount: Number(b.artist.stats?.playcount ?? 0),
    tags: (b.artist.tags?.tag ?? []).map((t: any) => t.name),
  }))
}
