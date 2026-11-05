import { describe, expect, it } from 'vitest'
import { parseLineupPage, parseSitemap, parseSlug } from './festivals.ts'

const chunk = (s: string) => `<script>self.__next_f.push([1,${JSON.stringify(s)}])</script>`

describe('festival slugs and sitemap', () => {
  it('parses name and year from a slug', () => {
    expect(parseSlug('electric-forest-2026-rothburymi')).toEqual({
      slug: 'electric-forest-2026-rothburymi',
      name: 'Electric Forest',
      year: 2026,
    })
    expect(parseSlug('nonsense')).toBeNull()
  })

  it('lists festivals from the sitemap lineup urls only', () => {
    const xml = `<loc>https://x.com/festivals/a-b-2025-cityst/lineup</loc><loc>https://x.com/festivals/a-b-2025-cityst/set-times</loc>`
    expect(parseSitemap(xml).map((f) => f.slug)).toEqual(['a-b-2025-cityst'])
  })
})

describe('parseLineupPage', () => {
  const festival = {
    festival: {
      name: 'Test Fest',
      dateEnd: '2026-06-28',
      lineup: [
        { artistName: 'LANE 8', likes: 10 },
        { artistName: 'Lane 8', likes: 30 },
        { artistName: 'YOGA WITH SOMEONE', likes: 5 },
        { artistName: 'DJ ONE B2B DJ TWO', likes: 7 },
      ],
    },
  }
  const catalog = { 'lane-8': { name: 'Lane 8', spotifyId: 'x', genres: ['house'] } }
  const html =
    chunk(`4:["$","$L1",null,${JSON.stringify(festival)}]`) + chunk(`9:{"artists":${JSON.stringify(catalog)}}`)

  it('dedupes, fixes casing, drops non-music and splits b2b sets', () => {
    const result = parseLineupPage('test-fest-2026-cityst', html)
    expect(result.name).toBe('Test Fest 2026')
    expect(result.artists).toEqual([
      { name: 'Lane 8', likes: 30 },
      { name: 'Dj One', likes: 7 },
      { name: 'Dj Two', likes: 7 },
    ])
  })

  it('fails clearly on an unreadable page', () => {
    expect(() => parseLineupPage('x', '<html></html>')).toThrow()
  })
})
