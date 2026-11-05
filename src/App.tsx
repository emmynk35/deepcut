import { useEffect, useState } from 'react'
import { spotifyGet } from './spotify/api.ts'
import { getAccessToken, handleCallback, login, logout } from './spotify/auth.ts'

interface SpotifyArtist {
  id: string
  name: string
  genres?: string[]
}

type Check = { label: string; status: 'ok' | 'fail'; detail: string }

// Temporary Phase 1 spike: confirms which Spotify endpoints work for this app.
async function runChecks(): Promise<Check[]> {
  const checks: Check[] = []
  const run = async (label: string, fn: () => Promise<string>) => {
    try {
      checks.push({ label, status: 'ok', detail: await fn() })
    } catch (err) {
      checks.push({ label, status: 'fail', detail: String(err) })
    }
  }

  let first: SpotifyArtist | undefined
  await run('GET /me/top/artists', async () => {
    const r = await spotifyGet<{ items: SpotifyArtist[] }>('/me/top/artists?limit=10&time_range=medium_term')
    first = r.items[0]
    return r.items.map((a) => `${a.name} [${(a.genres ?? ['<no genres field>']).join(', ')}]`).join(' | ')
  })
  await run('GET /artists/{id} (genres)', async () => {
    if (!first) throw new Error('no top artist to test')
    const a = await spotifyGet<SpotifyArtist & Record<string, unknown>>(`/artists/${first.id}`)
    return `${a.name}: genres=${JSON.stringify(a.genres)}, popularity=${String(a.popularity)}, followers=${JSON.stringify(a.followers)}`
  })
  await run('GET /me/top/tracks', async () => {
    const r = await spotifyGet<{ items: unknown[] }>('/me/top/tracks?limit=5')
    return `${r.items.length} tracks`
  })
  await run('GET /me/player/recently-played', async () => {
    const r = await spotifyGet<{ items: unknown[] }>('/me/player/recently-played?limit=5')
    return `${r.items.length} items`
  })
  await run('GET /me/tracks (saved)', async () => {
    const r = await spotifyGet<{ total: number }>('/me/tracks?limit=5')
    return `${r.total} saved`
  })
  await run('GET /me/following?type=artist', async () => {
    const r = await spotifyGet<{ artists: { items: unknown[] } }>('/me/following?type=artist&limit=5')
    return `${r.artists.items.length} followed`
  })
  await run('GET /search (track, limit 10)', async () => {
    const r = await spotifyGet<{ tracks: { items: { name: string; artists: { name: string }[] }[] } }>(
      '/search?q=artist:Overmono&type=track&limit=10',
    )
    return r.tracks.items.map((t) => `${t.name} — ${t.artists.map((a) => a.name).join(', ')}`).join(' | ')
  })
  return checks
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => getAccessToken() !== null)
  const [checks, setChecks] = useState<Check[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    handleCallback()
      .then((done) => done && setLoggedIn(true))
      .catch((e) => setError(String(e)))
  }, [])

  useEffect(() => {
    if (loggedIn) runChecks().then(setChecks)
  }, [loggedIn])

  return (
    <main style={{ padding: 24, textAlign: 'left', fontFamily: 'system-ui' }}>
      <h1>DeepCut</h1>
      <p>Find the artists you didn't know you came for.</p>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {!loggedIn ? (
        <button onClick={() => login()}>Connect Spotify</button>
      ) : (
        <>
          <button
            onClick={() => {
              logout()
              setLoggedIn(false)
              setChecks(null)
            }}
          >
            Log out
          </button>
          <h2>Spotify endpoint checks</h2>
          {!checks && <p>Running…</p>}
          <ul>
            {checks?.map((c) => (
              <li key={c.label}>
                {c.status === 'ok' ? '✅' : '❌'} <b>{c.label}</b>: {c.detail}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  )
}
