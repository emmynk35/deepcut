import { useEffect, useMemo, useState } from 'react'
import ArtistCard from './ArtistCard.tsx'
import { loadSaved, persistSaved, toggleSaved } from './saved.ts'
import type { PickedTrack } from './recommend/pickTracks.ts'
import type { Recommendation } from './recommend/score.ts'
import { getAccessToken, handleCallback, login, logout } from './spotify/auth.ts'
import { createPlaylist } from './spotify/playlist.ts'
import { fetchTasteProfile } from './spotify/taste.ts'
import { findTracks } from './spotify/tracks.ts'

interface Festival {
  festival: { name: string; location: string; dates: { start: string; end: string } }
  artists: { name: string }[]
}

type Phase = 'idle' | 'profile' | 'ranking' | 'done'

const PHASE_LABEL: Record<Phase, string> = {
  idle: '',
  profile: 'Reading your Spotify taste…',
  ranking: 'Ranking the lineup (the first run can take a minute)…',
  done: '',
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => getAccessToken() !== null)
  const [festival, setFestival] = useState<Festival | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [tracks, setTracks] = useState<Record<string, PickedTrack[]>>({})
  const [saved, setSaved] = useState<string[]>(() => loadSaved())
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    handleCallback()
      .then((done) => done && setLoggedIn(true))
      .catch((e) => setError(String(e)))
  }, [])

  useEffect(() => {
    fetch('/api/festival')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Lineup failed (${res.status})`))))
      .then(setFestival)
      .catch((e) => setError(String(e)))
  }, [])

  const uris = useMemo(() => recs.flatMap((r) => (tracks[r.name] ?? []).map((t) => t.uri)), [recs, tracks])

  async function discover() {
    setError(null)
    setPlaylistUrl(null)
    setRecs([])
    setTracks({})
    try {
      setPhase('profile')
      const profile = await fetchTasteProfile()
      setPhase('ranking')
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taste: profile.taste, familiar: profile.familiar, limit: 10 }),
      })
      if (!res.ok) throw new Error(`Recommend failed (${res.status})`)
      const list: Recommendation[] = await res.json()
      setRecs(list)
      setPhase('done')
      await Promise.all(
        list.map(async (r) => {
          const found = await findTracks(r.name).catch(() => [])
          setTracks((prev) => ({ ...prev, [r.name]: found }))
        }),
      )
    } catch (e) {
      setError(String(e))
      setPhase('idle')
    }
  }

  async function exportPlaylist() {
    if (!festival) return
    setCreating(true)
    setError(null)
    try {
      setPlaylistUrl(
        await createPlaylist(
          `DeepCut — ${festival.festival.name}`,
          'Hidden gems from the lineup, picked from my Spotify taste.',
          uris,
        ),
      )
    } catch (e) {
      setError(String(e))
    } finally {
      setCreating(false)
    }
  }

  function onToggleSave(name: string) {
    const next = toggleSaved(saved, name)
    setSaved(next)
    persistSaved(next)
  }

  const busy = phase === 'profile' || phase === 'ranking'

  return (
    <main className="app">
      <header className="header">
        <div>
          <h1>DeepCut</h1>
          <p className="tagline">Find the artists you didn't know you came for.</p>
        </div>
        {loggedIn && (
          <button
            onClick={() => {
              logout()
              setLoggedIn(false)
              setRecs([])
            }}
          >
            Log out
          </button>
        )}
      </header>

      {error && <p className="error">{error}</p>}

      {!loggedIn ? (
        <section className="hero">
          <h2 style={{ marginTop: 0 }}>{festival?.festival.name ?? 'Your festival'}</h2>
          <p>
            Connect Spotify and DeepCut finds the smaller acts on the lineup that match your taste, then builds a
            playlist to listen to before you go.
          </p>
          <button className="primary" onClick={() => login()}>
            Connect Spotify
          </button>
        </section>
      ) : (
        <>
          <h2>{festival?.festival.name ?? 'Festival'}</h2>
          <button className="primary" disabled={busy} onClick={discover}>
            {recs.length ? 'Run again' : 'Find my hidden gems'}
          </button>
          {busy && <p>{PHASE_LABEL[phase]}</p>}

          {recs.length > 0 && (
            <>
              <h2>Your hidden gems</h2>
              <ul className="grid">
                {recs.map((r) => (
                  <ArtistCard
                    key={r.name}
                    rec={r}
                    tracks={tracks[r.name]}
                    saved={saved.includes(r.name)}
                    onToggleSave={() => onToggleSave(r.name)}
                  />
                ))}
              </ul>

              <h2>Playlist</h2>
              <p>{uris.length} tracks from these artists.</p>
              {playlistUrl ? (
                <p>
                  Playlist created: <a href={playlistUrl}>open in Spotify</a>
                </p>
              ) : (
                <button className="primary" disabled={creating || uris.length === 0} onClick={exportPlaylist}>
                  {creating ? 'Creating…' : 'Create Spotify playlist'}
                </button>
              )}
            </>
          )}
        </>
      )}

      {saved.length > 0 && (
        <>
          <h2>Saved to see live</h2>
          <ul>
            {saved.map((name) => (
              <li key={name}>
                {name} <button onClick={() => onToggleSave(name)}>Remove</button>
              </li>
            ))}
          </ul>
        </>
      )}

      {festival && (
        <details style={{ marginTop: 32 }}>
          <summary>
            Full lineup ({festival.artists.length} acts) · {festival.festival.location}
          </summary>
          <p className="meta">{festival.artists.map((a) => a.name).join(' · ')}</p>
        </details>
      )}

      <footer className="footer">
        Artist similarity data from <a href="https://www.last.fm">Last.fm</a>.
      </footer>
    </main>
  )
}
