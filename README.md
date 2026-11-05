# DeepCut

> Find the artists you didn't know you came for.

DeepCut helps festivalgoers discover smaller, under-the-radar artists on an upcoming festival lineup based on their Spotify listening taste.

## How it works

1. **Choose a festival** – pick a lineup.
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
- Data: curated festival lineup (`data/`), Last.fm (similar artists, listener counts, tags), Spotify Web API (taste profile, playlists)

## Getting started

Requires Node.js 20.19+ (or 22.12+) and npm.

```bash
npm install
cp .env.example .env   # then set LASTFM_API_KEY (free: https://www.last.fm/api/account/create)
npm run dev            # web at http://localhost:5173, API at http://127.0.0.1:3001
npm run build    # type-check and production build
npm run lint     # lint
npm run preview  # preview the production build
```

## Roadmap

- **Phase 1** – Project setup, one festival lineup, Spotify OAuth, listening data.
- **Phase 2** – Discovery algorithm and representative tracks.
- **Phase 3** – Frontend experience: festival page, artist cards, playlist export, saved list.
- **Phase 4** – Polish: tuning controls, discovery intensity, responsive UI.

## Attribution and data terms

Artist similarity data is provided by [Last.fm](https://www.last.fm). This is a non-commercial portfolio project and is not publicly hosted (Last.fm requires written approval for public pages). Cached Last.fm data is not committed; regenerate it with `npm run coverage:lastfm`. Spotify data comes from the Spotify Web API under Development Mode.

## Status

Early development.
