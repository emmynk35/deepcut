import { describe, expect, it } from 'vitest'
import { explain } from './explain.ts'
import { pickTracks } from './pickTracks.ts'

const track = (name: string, artist: string, uri = `spotify:track:${name}`) => ({
  uri,
  name,
  artists: [{ name: artist }],
})

describe('pickTracks', () => {
  it('keeps only the artist tracks, drops duplicate titles, and caps the count', () => {
    const results = [
      track('A', 'Other'),
      track('B', 'Dixon’s Violin'),
      track('B', "Dixon's Violin", 'spotify:track:dupe'),
      track('C', "dixon's violin"),
      track('D', "Dixon's Violin"),
      track('E', "Dixon's Violin"),
    ]
    expect(pickTracks("Dixon's Violin", results).map((t) => t.name)).toEqual(['B', 'C', 'D'])
  })

  it('returns nothing when no track is by the artist', () => {
    expect(pickTracks('Nobody', [track('A', 'Other')])).toEqual([])
  })
})

describe('explain', () => {
  it('names the matched artists', () => {
    const text = explain({
      name: 'X',
      score: 0.5,
      taste: 0.8,
      discovery: 0.7,
      reasons: [
        { artist: 'Lane 8', similarity: 0.5 },
        { artist: 'Zedd', similarity: 0.4 },
      ],
    })
    expect(text).toContain('Lane 8 and Zedd')
    expect(text).toContain('hidden gem')
  })
})
