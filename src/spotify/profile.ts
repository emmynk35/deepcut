import { normalizeName } from '../recommend/normalize.ts'
import type { TasteArtist } from '../recommend/score.ts'

export interface TasteProfile {
  // Strongest signals, used to match against the lineup.
  taste: TasteArtist[]
  // Everything the user already knows, excluded from recommendations.
  familiar: string[]
}

export type SignalSource = 'top-short' | 'top-medium' | 'top-long' | 'followed' | 'saved' | 'recent'

export interface Signal {
  source: SignalSource
  // Artist names in order of importance (most important first).
  artists: string[]
}

const SOURCE_WEIGHT: Record<SignalSource, number> = {
  'top-long': 1,
  'top-medium': 0.8,
  'top-short': 0.6,
  followed: 0.5,
  saved: 0.4,
  recent: 0.3,
}

const TASTE_SIZE = 25

// Pure: merges ranked signals into weighted taste artists. Higher rank in a signal counts more.
export function buildProfile(signals: Signal[]): TasteProfile {
  const scores = new Map<string, { name: string; score: number }>()
  for (const signal of signals) {
    const total = signal.artists.length
    signal.artists.forEach((name, index) => {
      const key = normalizeName(name)
      if (!key) return
      const rankFactor = total > 1 ? 1 - (index / total) * 0.7 : 1
      const entry = scores.get(key) ?? { name, score: 0 }
      entry.score += SOURCE_WEIGHT[signal.source] * rankFactor
      scores.set(key, entry)
    })
  }
  const sorted = [...scores.values()].sort((a, b) => b.score - a.score)
  const max = sorted[0]?.score ?? 1
  return {
    taste: sorted.slice(0, TASTE_SIZE).map((e) => ({ name: e.name, weight: e.score / max })),
    familiar: sorted.map((e) => e.name),
  }
}
