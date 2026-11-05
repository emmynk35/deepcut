import { describe, expect, it } from 'vitest'
import { loadSaved, persistSaved, toggleSaved } from './saved.ts'

describe('saved list', () => {
  it('toggles artists on and off', () => {
    expect(toggleSaved(['A'], 'B')).toEqual(['A', 'B'])
    expect(toggleSaved(['A', 'B'], 'A')).toEqual(['B'])
  })

  it('round-trips through storage and tolerates bad data', () => {
    const data: Record<string, string> = {}
    persistSaved(['A', 'B'], { setItem: (k, v) => void (data[k] = v) })
    expect(loadSaved({ getItem: (k) => data[k] ?? null })).toEqual(['A', 'B'])
    expect(loadSaved({ getItem: () => '{oops' })).toEqual([])
    expect(loadSaved({ getItem: () => '[1,"A"]' })).toEqual(['A'])
  })
})
