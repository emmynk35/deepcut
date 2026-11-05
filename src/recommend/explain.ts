import type { Recommendation } from './score.ts'

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export function explain(rec: Recommendation): string {
  const names = rec.reasons.slice(0, 3).map((r) => r.artist)
  const fit = rec.taste >= 0.7 ? 'a strong match' : rec.taste >= 0.4 ? 'a good match' : 'a possible match'
  const size = rec.discovery >= 0.6 ? 'a true hidden gem' : rec.discovery >= 0.35 ? 'still under the radar' : 'fairly well known'
  return `Because you listen to ${joinNames(names)} — ${fit}, and ${size}.`
}
