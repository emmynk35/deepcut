import { normalizeName } from './normalize.ts'

export interface SimilarArtist {
  name: string
  match: number
}

export interface LineupArtist {
  name: string
  listeners: number
  likes?: number
  similar: SimilarArtist[]
}

export interface TasteArtist {
  name: string
  weight: number
}

export interface ScoreOptions {
  tasteWeight?: number
  discoveryWeight?: number
  // Artists the user already knows; never recommended.
  familiar?: string[]
  // Last.fm neighbors of the user's artists, keyed by artist name. Adds the reverse direction.
  userSimilar?: Record<string, SimilarArtist[]>
  // Acts less "discoverable" than this (too popular) are dropped.
  minDiscovery?: number
  limit?: number
}

export interface Reason {
  artist: string
  similarity: number
}

export interface Recommendation {
  name: string
  score: number
  taste: number
  discovery: number
  reasons: Reason[]
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

function smallness(value: number, min: number, max: number): number {
  if (max === min) return 0.5
  const t = (Math.log10(value + 1) - Math.log10(min + 1)) / (Math.log10(max + 1) - Math.log10(min + 1))
  return clamp01(1 - t)
}

function similarity(candidate: LineupArtist, user: TasteArtist, options: ScoreOptions): number {
  const userKey = normalizeName(user.name)
  const candidateKey = normalizeName(candidate.name)
  const forward = candidate.similar.find((s) => normalizeName(s.name) === userKey)?.match ?? 0
  const reverse =
    options.userSimilar?.[user.name]?.find((s) => normalizeName(s.name) === candidateKey)?.match ?? 0
  return Math.max(forward, reverse)
}

export function rankArtists(
  lineup: LineupArtist[],
  taste: TasteArtist[],
  options: ScoreOptions = {},
): Recommendation[] {
  const { tasteWeight = 0.6, discoveryWeight = 0.4, limit = 10, minDiscovery = 0.15 } = options
  const known = new Set([...(options.familiar ?? []), ...taste.map((t) => t.name)].map(normalizeName))
  const totalWeight = taste.reduce((sum, t) => sum + t.weight, 0)
  if (totalWeight === 0) return []

  const listeners = lineup.map((a) => a.listeners)
  // Festival likes are only used when every act has them (pasted lineups have none).
  const useLikes = lineup.every((a) => a.likes !== undefined)
  const likes = lineup.map((a) => a.likes ?? 0)
  const range = (xs: number[]) => [Math.min(...xs), Math.max(...xs)] as const
  const [minL, maxL] = range(listeners)
  const [minK, maxK] = range(likes)

  const candidates = lineup
    .filter((a) => !known.has(normalizeName(a.name)))
    .map((a) => {
      const reasons = taste
        .map((t) => ({ artist: t.name, similarity: similarity(a, t, options), weight: t.weight }))
        .filter((r) => r.similarity > 0)
      const rawTaste = reasons.reduce((sum, r) => sum + r.similarity * r.weight, 0) / totalWeight
      const listenerSmallness = smallness(a.listeners, minL, maxL)
      const discovery = useLikes ? 0.7 * listenerSmallness + 0.3 * smallness(a.likes ?? 0, minK, maxK) : listenerSmallness
      return {
        name: a.name,
        rawTaste,
        discovery,
        reasons: reasons
          .sort((x, y) => y.similarity * y.weight - x.similarity * x.weight)
          .map(({ artist, similarity: s }) => ({ artist, similarity: s })),
      }
    })
    .filter((c) => c.rawTaste > 0 && c.discovery >= minDiscovery)

  const maxTaste = Math.max(...candidates.map((c) => c.rawTaste), 0)
  return candidates
    .map((c) => {
      const tasteScore = c.rawTaste / maxTaste
      return {
        name: c.name,
        taste: tasteScore,
        discovery: c.discovery,
        score: Math.pow(tasteScore, tasteWeight) * Math.pow(c.discovery, discoveryWeight),
        reasons: c.reasons,
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
