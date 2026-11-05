import type { Recommendation } from './score.ts'

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export function explain(rec: Recommendation): string {
  const names = rec.reasons.slice(0, 3).map((r) => r.artist)
  return `Because you listen to ${joinNames(names)}`
}

export function matchRating(rec: Recommendation): string {
  return `${(rec.taste * 10).toFixed(1)}/10 match`
}
