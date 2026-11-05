import { describe, expect, it } from 'vitest'
import { normalizeName } from './normalize.ts'
import { rankArtists, type LineupArtist } from './score.ts'

describe('normalizeName', () => {
  it('treats curly and straight apostrophes the same', () => {
    expect(normalizeName('Barry Can’t Swim')).toBe(normalizeName("Barry Can't Swim"))
  })

  it('ignores case, punctuation and accents', () => {
    expect(normalizeName('Fred again..')).toBe('fred again')
    expect(normalizeName('Beyoncé')).toBe('beyonce')
  })
})

const lineup: LineupArtist[] = [
  { name: 'Big Act', listeners: 1_000_000, likes: 1000, similar: [{ name: 'Overmono', match: 0.9 }] },
  { name: 'Small Act', listeners: 5_000, likes: 50, similar: [{ name: 'Overmono', match: 0.8 }] },
  { name: 'Unrelated', listeners: 2_000, likes: 20, similar: [{ name: 'Metallica', match: 1 }] },
  { name: 'Overmono', listeners: 300_000, likes: 500, similar: [] },
]

describe('rankArtists', () => {
  const taste = [{ name: 'Overmono', weight: 1 }]

  it('prefers smaller artists when taste match is close', () => {
    const [first] = rankArtists(lineup, taste)
    expect(first.name).toBe('Small Act')
  })

  it('excludes unrelated and familiar artists', () => {
    const names = rankArtists(lineup, taste).map((r) => r.name)
    expect(names).not.toContain('Unrelated')
    expect(names).not.toContain('Overmono')
    expect(rankArtists(lineup, taste, { familiar: ['Small Act'] }).map((r) => r.name)).toEqual(['Big Act'])
  })

  it('uses the reverse direction from the user artist neighbors', () => {
    const result = rankArtists(lineup, [{ name: 'Fred again..', weight: 1 }], {
      userSimilar: { 'Fred again..': [{ name: 'small act', match: 0.7 }] },
    })
    expect(result.map((r) => r.name)).toEqual(['Small Act'])
    expect(result[0].reasons).toEqual([{ artist: 'Fred again..', similarity: 0.7 }])
  })

  it('returns nothing without taste data', () => {
    expect(rankArtists(lineup, [])).toEqual([])
  })

  it('respects the limit', () => {
    expect(rankArtists(lineup, taste, { limit: 1 })).toHaveLength(1)
  })
})
