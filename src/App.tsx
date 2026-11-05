import { useEffect, useMemo, useState } from 'react'
import ArtistCard from './ArtistCard.tsx'
import { loadLineup, persistLineup, type FestivalSummary, type Lineup } from './lineup.ts'
import { loadSaved, persistSaved, toggleSaved } from './saved.ts'
import type { PickedTrack } from './recommend/pickTracks.ts'
import type { Recommendation } from './recommend/score.ts'
import { getAccessToken, handleCallback, login, logout } from './spotify/auth.ts'
import { createPlaylist } from './spotify/playlist.ts'
import type { TasteProfile } from './spotify/profile.ts'
import { fetchTasteProfile } from './spotify/taste.ts'
import { findTracks } from './spotify/tracks.ts'

type Phase = 'idle' | 'profile' | 'ranking' | 'done'

const PHASE_LABEL: Record<Phase, string> = {
  idle: '',
  profile: 'Reading your Spotify taste…',
  ranking: 'Looking up the lineup on Last.fm (the first run can take a minute)…',
  done: '',
}

// Fixed product choices: always go for lesser-known acts, always 21 of them.
const ADVENTUROUS = 1
const ARTIST_COUNT = 21

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? `Request failed (${res.status})`)
  }
  return res.json()
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => getAccessToken() !== null)
  const [lineup, setLineup] = useState<Lineup | null>(() => loadLineup())
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FestivalSummary[]>([])
  const [searching, setSearching] = useState(false)
  const [loadingLineup, setLoadingLineup] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [tracks, setTracks] = useState<Record<string, PickedTrack[]>>({})
  const [saved, setSaved] = useState<string[]>(() => loadSaved())
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [profile, setProfile] = useState<TasteProfile | null>(null)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    handleCallback()
      .then((done) => done && setLoggedIn(true))
      .catch((e) => setError(String(e)))
  }, [])

  const trimmed = query.trim()
  const visibleResults = trimmed.length >= 2 ? results : []

  useEffect(() => {
    if (trimmed.length < 2) return
    const timer = setTimeout(() => {
      setSearching(true)
      getJson<FestivalSummary[]>(`/api/festivals/search?q=${encodeURIComponent(trimmed)}`)
        .then(setResults)
        .catch((e) => setError(String(e)))
        .finally(() => setSearching(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [trimmed])

  const uris = useMemo(() => recs.flatMap((r) => (tracks[r.name] ?? []).map((t) => t.uri)), [recs, tracks])

  function resetResults() {
    setRecs([])
    setTracks({})
    setPlaylistUrl(null)
  }

  async function chooseFestival(festival: FestivalSummary) {
    setError(null)
    setLoadingLineup(true)
    try {
      const data = await getJson<Lineup & { slug: string }>(`/api/festivals/${festival.slug}`)
      const next = { name: data.name, artists: data.artists }
      persistLineup(next)
      setLineup(next)
      setQuery('')
      setResults([])
      resetResults()
    } catch (e) {
      setError(String(e))
    } finally {
      setLoadingLineup(false)
    }
  }

  async function discover() {
    if (!lineup) return
    setError(null)
    resetResults()
    try {
      let taste = profile
      if (!taste) {
        setPhase('profile')
        taste = await fetchTasteProfile()
        setProfile(taste)
      }
      setPhase('ranking')
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artists: lineup.artists,
          taste: taste.taste,
          familiar: taste.familiar,
          limit: ARTIST_COUNT,
          discovery: ADVENTUROUS,
        }),
      })
      if (!res.ok) throw new Error(`Recommend failed (${res.status})`)
      const data: { recommendations: Recommendation[] } = await res.json()
      setRecs(data.recommendations)
      setPhase('done')
      await Promise.all(
        data.recommendations.map(async (r) => {
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
    if (!lineup) return
    setCreating(true)
    setError(null)
    try {
      setPlaylistUrl(
        await createPlaylist(
          `DeepCut — ${lineup.name}`,
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
              resetResults()
              setProfile(null)
            }}
          >
            Log out
          </button>
        )}
      </header>

      {error && <p className="error">{error}</p>}

      <h2>Festival</h2>
      <section className={lineup ? undefined : 'hero'}>
        <div className="picker">
          <input
            aria-label="Search for a festival"
            value={editing ? query : (lineup?.name ?? '')}
            onFocus={() => {
              setEditing(true)
              setQuery('')
            }}
            onBlur={() => setTimeout(() => setEditing(false), 150)}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={lineup ? `${lineup.name} — search to change` : 'Search for a festival, e.g. Electric Forest'}
          />
          {editing && (visibleResults.length > 0 || searching || loadingLineup || trimmed.length >= 2) && (
            <ul className="results">
              {(searching || loadingLineup) && <li className="meta">{loadingLineup ? 'Loading lineup…' : 'Searching…'}</li>}
              {visibleResults.map((f) => (
                <li key={f.slug}>
                  <button disabled={loadingLineup} onMouseDown={(e) => e.preventDefault()} onClick={() => chooseFestival(f)}>
                    {f.name} {f.year}
                  </button>
                </li>
              ))}
              {!searching && trimmed.length >= 2 && visibleResults.length === 0 && (
                <li className="meta">No festivals found for "{trimmed}".</li>
              )}
            </ul>
          )}
        </div>
        {lineup && (
          <details className="lineup">
            <summary>{lineup.artists.length} acts on the lineup</summary>
            <ul className="chips">
              {lineup.artists.map((a) => (
                <li key={a.name}>{a.name}</li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {lineup && (
        <>
          <h2>Your hidden gems</h2>
          {!loggedIn ? (
            <section className="hero">
              <p style={{ marginTop: 0 }}>
                Connect Spotify and DeepCut finds the smaller acts on this lineup that match your taste.
              </p>
              <button className="primary" onClick={() => login()}>
                Connect Spotify
              </button>
            </section>
          ) : (
            <>
              <button className="primary" disabled={busy} onClick={discover}>
                {recs.length ? 'Run again' : 'Find my hidden gems'}
              </button>
              {busy && <p>{PHASE_LABEL[phase]}</p>}
              {phase === 'done' && recs.length === 0 && <p>No hidden gems found on this lineup.</p>}
            </>
          )}
        </>
      )}

      {recs.length > 0 && (
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

      <footer className="footer">
        Artist similarity data from <a href="https://www.last.fm">Last.fm</a>. Festival lineups from{' '}
        <a href="https://www.festivaldust.com">Festival Dust</a>.
      </footer>

      {recs.length > 0 && (
        <div className="playlist-bar">
          <span>{uris.length} tracks ready for your playlist</span>
          {playlistUrl ? (
            <a className="button-link" href={playlistUrl} target="_blank" rel="noreferrer">
              Open playlist in Spotify ↗
            </a>
          ) : (
            <button className="primary big" disabled={creating || uris.length === 0} onClick={exportPlaylist}>
              {creating ? 'Creating…' : '▶ Create Spotify playlist'}
            </button>
          )}
        </div>
      )}
    </main>
  )
}
