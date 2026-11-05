import { describe, expect, it } from 'vitest'
import { loadLineup, persistLineup } from './lineup.ts'

describe('lineup storage', () => {
  it('round-trips and tolerates bad data', () => {
    const data: Record<string, string> = {}
    const lineup = { name: 'F', artists: [{ name: 'A', likes: 3 }] }
    persistLineup(lineup, { setItem: (k, v) => void (data[k] = v) })
    expect(loadLineup({ getItem: (k) => data[k] ?? null })).toEqual(lineup)
    expect(loadLineup({ getItem: () => 'nope' })).toBeNull()
  })

  it('drops malformed artists', () => {
    const raw = JSON.stringify({ name: 'F', artists: [{ name: 'A', likes: 1 }, 'x', { name: 2 }] })
    expect(loadLineup({ getItem: () => raw })?.artists).toEqual([{ name: 'A', likes: 1 }])
  })
})
