import { describe, expect, it } from 'vitest'
import { buildProfile } from './profile.ts'

describe('buildProfile', () => {
  it('weights artists seen in several signals higher and normalizes to 1', () => {
    const profile = buildProfile([
      { source: 'top-long', artists: ['A', 'B'] },
      { source: 'saved', artists: ['B', 'C'] },
    ])
    expect(profile.taste[0].name).toBe('B')
    expect(profile.taste[0].weight).toBe(1)
    expect(profile.familiar).toEqual(expect.arrayContaining(['A', 'B', 'C']))
  })

  it('merges names that differ only by punctuation or case', () => {
    const profile = buildProfile([
      { source: 'top-long', artists: ['Dixon’s Violin'] },
      { source: 'followed', artists: ["dixon's violin"] },
    ])
    expect(profile.familiar).toHaveLength(1)
  })

  it('keeps all artists as familiar but caps taste size', () => {
    const names = Array.from({ length: 80 }, (_, i) => `Artist ${i}`)
    const profile = buildProfile([{ source: 'top-long', artists: names }])
    expect(profile.taste).toHaveLength(50)
    expect(profile.familiar).toHaveLength(80)
  })
})
