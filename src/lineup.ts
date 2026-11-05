export interface LineupArtist {
  name: string
  likes: number
}

export interface Lineup {
  name: string
  artists: LineupArtist[]
}

export interface FestivalSummary {
  slug: string
  name: string
  year: number
}

const KEY = 'deepcut.lineup'

function isArtist(a: unknown): a is LineupArtist {
  return typeof (a as LineupArtist)?.name === 'string' && typeof (a as LineupArtist)?.likes === 'number'
}

export function loadLineup(storage: Pick<Storage, 'getItem'> = localStorage): Lineup | null {
  try {
    const parsed = JSON.parse(storage.getItem(KEY) ?? 'null')
    if (typeof parsed?.name === 'string' && Array.isArray(parsed.artists)) {
      return { name: parsed.name, artists: parsed.artists.filter(isArtist) }
    }
  } catch {
    // fall through to null
  }
  return null
}

export function persistLineup(lineup: Lineup, storage: Pick<Storage, 'setItem'> = localStorage): void {
  storage.setItem(KEY, JSON.stringify(lineup))
}
