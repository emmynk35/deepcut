import { useEffect, useState } from 'react'
import { spotifyGet } from './spotify/api.ts'
import { normalizeName } from './recommend/normalize.ts'
import { fetchTasteProfile } from './spotify/taste.ts'
import type { TasteProfile } from './spotify/profile.ts'
import type { Recommendation } from './recommend/score.ts'
import { explain } from './recommend/explain.ts'
import type { PickedTrack } from './recommend/pickTracks.ts'
import { findTracks } from './spotify/tracks.ts'
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

// S5: can we find the right Spotify artist's tracks by searching artist:"name"?
async function runTrackMapping(): Promise<string[]> {
  const res = await fetch('/api/festival')
  if (!res.ok) throw new Error(`/api/festival failed (${res.status}); is the API server running?`)
  const { artists } = (await res.json()) as { artists: { name: string }[] }
  const sample = artists.filter((_, i) => i % Math.floor(artists.length / 20) === 0).slice(0, 20)
  const lines: string[] = []
  let correct = 0
  for (const { name } of sample) {
    try {
      const r = await spotifyGet<{ tracks: { items: { uri: string; name: string; artists: { name: string }[] }[] } }>(
        `/search?q=${encodeURIComponent(`artist:"${name}"`)}&type=track&limit=10`,
      )
      const key = normalizeName(name)
      const hits = r.tracks.items.filter((t) => t.artists.some((a) => normalizeName(a.name) === key))
      if (hits.length > 0) correct++
      lines.push(`${hits.length > 0 ? '✅' : '❌'} ${name}: ${hits.length}/${r.tracks.items.length} tracks by this artist${hits[0] ? ` (e.g. ${hits[0].name})` : ''}`)
    } catch (err) {
      lines.push(`❌ ${name}: ${String(err)}`)
    }
  }
  return [`Correct artist found for ${correct}/${sample.length} (${Math.round((correct / sample.length) * 100)}%)`, ...lines]
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => getAccessToken() !== null)
  const [checks, setChecks] = useState<Check[] | null>(null)
  const [mapping, setMapping] = useState<string[] | 'running' | null>(null)
  const [profile, setProfile] = useState<TasteProfile | 'running' | null>(null)
  const [recs, setRecs] = useState<Recommendation[] | 'running' | null>(null)
  const [tracks, setTracks] = useState<Record<string, PickedTrack[]>>({})
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
          <h2>Track mapping test (S5)</h2>
          <button
            disabled={mapping === 'running'}
            onClick={() => {
              setMapping('running')
              runTrackMapping()
                .then(setMapping)
                .catch((e) => setMapping([`❌ ${String(e)}`]))
            }}
          >
            Run track mapping test
          </button>
          {mapping === 'running' && <p>Running… (about 20 searches)</p>}
          {Array.isArray(mapping) && (
            <ul>
              {mapping.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          )}
          <h2>Taste profile</h2>
          <button
            disabled={profile === 'running'}
            onClick={() => {
              setProfile('running')
              fetchTasteProfile()
                .then(setProfile)
                .catch((e) => {
                  setProfile(null)
                  setError(String(e))
                })
            }}
          >
            Build taste profile
          </button>
          {profile === 'running' && <p>Running…</p>}
          {profile && profile !== 'running' && (
            <>
              <p>{profile.familiar.length} artists known. Top taste artists:</p>
              <ol>
                {profile.taste.map((t) => (
                  <li key={t.name}>
                    {t.name} ({t.weight.toFixed(2)})
                  </li>
                ))}
              </ol>
              <h2>Recommendations</h2>
              <button
                disabled={recs === 'running'}
                onClick={() => {
                  setRecs('running')
                  fetch('/api/recommend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ taste: profile.taste, familiar: profile.familiar, limit: 10 }),
                  })
                    .then(async (res) => {
                      if (!res.ok) throw new Error(`Recommend failed (${res.status})`)
                      const list: Recommendation[] = await res.json()
                      setRecs(list)
                      const entries = await Promise.all(
                        list.map(async (r) => [r.name, await findTracks(r.name).catch(() => [])] as const),
                      )
                      setTracks(Object.fromEntries(entries))
                    })
                    .catch((e) => {
                      setRecs(null)
                      setError(String(e))
                    })
                }}
              >
                Find hidden gems
              </button>
              {recs === 'running' && <p>Running… the first run can take a minute (Last.fm lookups).</p>}
              {Array.isArray(recs) && (
                <ol>
                  {recs.map((r) => (
                    <li key={r.name}>
                      <b>{r.name}</b> — score {r.score.toFixed(2)}
                      <div>{explain(r)}</div>
                      <div style={{ fontSize: 13 }}>
                        {tracks[r.name]
                          ? tracks[r.name].length
                            ? tracks[r.name].map((t) => t.name).join(' · ')
                            : 'No tracks found on Spotify'
                          : 'Finding tracks…'}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </>
      )}
      <footer style={{ marginTop: 32, fontSize: 12 }}>
        Artist similarity data from <a href="https://www.last.fm">Last.fm</a>.
      </footer>
    </main>
  )
}
