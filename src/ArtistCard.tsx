import type { Recommendation } from './recommend/score.ts'
import type { PickedTrack } from './recommend/pickTracks.ts'
import { explain, matchRating } from './recommend/explain.ts'

interface Props {
  rec: Recommendation
  tracks: PickedTrack[] | undefined
  saved: boolean
  onToggleSave: () => void
}

export default function ArtistCard({ rec, tracks, saved, onToggleSave }: Props) {
  return (
    <li className="card">
      <h3>{rec.name}</h3>
      <p className="meta">{matchRating(rec)}</p>
      <p className="why">{explain(rec)}</p>
      {tracks === undefined && <p className="meta">Finding tracks…</p>}
      {tracks?.length === 0 && <p className="meta">No tracks found on Spotify</p>}
      {tracks && tracks.length > 0 && (
        <ul className="tracks">
          {tracks.map((t) => (
            <li key={t.uri}>{t.name}</li>
          ))}
        </ul>
      )}
      <div className="actions">
        <button onClick={onToggleSave} aria-pressed={saved}>
          {saved ? '★ Saved' : '☆ Save to see live'}
        </button>
        <a
          className="meta"
          href={`https://www.last.fm/music/${encodeURIComponent(rec.name)}`}
          target="_blank"
          rel="noreferrer"
        >
          Last.fm
        </a>
      </div>
    </li>
  )
}
