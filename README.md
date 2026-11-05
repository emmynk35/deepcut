# DeepCut

> Find the artists you didn't know you came for.

DeepCut helps festivalgoers discover smaller, under-the-radar artists on an upcoming festival lineup based on their Spotify listening taste.

## How it works

1. **Choose a festival** – search by name and the lineup loads automatically.
2. **Connect Spotify** – analyze your listening history and favorite artists.
3. **Discover hidden gems** – smaller lineup artists that match your taste.
4. **Explore** – recommended songs and why each artist might appeal to you.
5. **Generate a playlist** – listen before the festival.
6. **Save discoveries** – keep a list of artists to see live.

## Ranking approach

Artists are ranked with a transparent weighted model:

```
Discovery Score = Taste Match × Discovery Potential
```

Signals: listening history, similar artists/genres, familiarity, artist popularity, and festival billing position.

## Tech stack

- Frontend: React + TypeScript (Vite)
- Backend: Node + Express + TypeScript (`server/`), keeps API keys off the browser
- Data: festival lineups (Festival Dust, fetched on demand), Last.fm (similar artists, listener counts), Spotify Web API (taste profile, track search, playlists)

## Getting started

Requires Node.js 20.19+ (or 22.12+), npm, and a Spotify Premium account (needed for Spotify Development Mode).

1. Create a free [Last.fm API key](https://www.last.fm/api/account/create).
2. Create a Spotify app at the [developer dashboard](https://developer.spotify.com/dashboard) and add the redirect URI `http://127.0.0.1:5173/callback` (use `127.0.0.1`, not `localhost`). No client secret is needed.
3. Run:

```bash
npm install
cp .env.example .env   # set LASTFM_API_KEY and VITE_SPOTIFY_CLIENT_ID
npm run dev            # web at http://127.0.0.1:5173, API at http://127.0.0.1:3001
npm test         # unit tests
npm run build    # type-check and production build
npm run lint     # lint
```

Open http://127.0.0.1:5173, search for a festival, connect Spotify, and click **Find my hidden gems**.

## Roadmap

- **Phase 1** – Setup, festival lineups, Spotify login, taste profile. ✅
- **Phase 2** – Discovery algorithm, representative tracks, explanations. ✅
- **Phase 3** – Festival search, artist cards, playlist export, saved list. ✅
- **Phase 4** – Polish: responsive UI, tuning, demo recording. In progress.

## Attribution and data terms

Artist similarity data is provided by [Last.fm](https://www.last.fm). This is a non-commercial portfolio project and is not publicly hosted (Last.fm requires written approval for public pages). Cached Last.fm data is not committed; regenerate it with `npm run coverage:lastfm`. Spotify data comes from the Spotify Web API under Development Mode. Festival lineups are read on demand from [Festival Dust](https://www.festivaldust.com), an unofficial source with no public API, so it may change or break without notice. Lineups are cached in memory only and not stored in this repository.

## Status

Early development.
