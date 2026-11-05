# DeepCut — Plan

Last updated: 2026-11-04

**MVP:** one festival → Spotify taste profile → 10 personalized emerging artists → curated playlist.

## Decisions

| Area | Decision | Why |
| --- | --- | --- |
| Frontend | React + TypeScript (Vite) | Showcase React |
| Backend | Node + Express + TypeScript (`server/`) | Keeps API keys off the browser; one language |
| Festival | Electric Forest 2026 (hand-curated JSON in `data/`) | EDMDb API is down for us; JSON has no external dependency |
| Similarity graph | Last.fm `artist.getsimilar` | Scored matches, tested and relevant for electronic acts |
| "Smallness" signal | Last.fm listener counts + festival "likes" | Spotify removed artist popularity/followers |
| Taste profile | Spotify `/me/top/artists`, `/me/top/tracks`, recently played, saved tracks, followed artists | Still available in Development Mode |
| Playlist export | Spotify `POST /me/playlists` + `POST /playlists/{id}/items` | Current (Feb 2026) endpoints |
| Persistence | `localStorage` for saved artists | Database deferred until needed |

## Findings that shaped the plan

- **Spotify (Feb–Mar 2026):** Related Artists, Recommendations, Audio Features, artist top tracks, artist `popularity`/`followers` and batch lookups are gone. Search is capped at 10 results. Development Mode needs Premium, allows 1 client ID and 5 authorized users.
- **EDMDb:** has a REST API (free tier 10k requests/month) but no similarity graph or popularity fields. Authenticated calls returned HTTP 500 on 2026-11-04, even with an invalid key. Not used for now.
- **Deezer:** keyless `related`, `nb_fan` and `top` all work, but there's no CORS, so it needs the server. Kept as a fallback.
- **Last.fm:** needs a key on every call (hence the server). Free for non-commercial use.

## Recommendation approach

```
Discovery Score = Taste Match × Discovery Potential
```

- **Taste match:** Last.fm similarity between the user's top artists and each lineup artist, plus tag/genre overlap.
- **Discovery potential:** low listener count, low festival likes, and not already known to the user.
- **Familiarity filter:** exclude artists in the user's top, followed, saved and recently played.
- **Explainability:** each result says which of the user's artists it matched and why.

## Phases

### Phase 0 — Foundations (done)
- [x] Vite + React + TypeScript app that runs locally
- [x] README, `.gitignore`, `.env.example`
- [x] Express API with Last.fm proxy + 24h cache
- [x] Electric Forest 2026 lineup (153 acts)
- [x] Commit baseline (conventional commits)

### Phase 1 — Data and Spotify (done)
- [x] Check Last.fm coverage across all 153 lineup acts; list misses
- [x] Register Spotify app; confirm redirect URI rules and that `/me/top/*` works (artist genres are gone)
- [x] Spotify OAuth (PKCE) login
- [x] Build taste profile from top/followed/saved/recent

### Phase 2 — Discovery algorithm (done)
- [x] Name normalization (Last.fm ↔ lineup ↔ Spotify)
- [x] Scoring model with unit tests
- [x] Representative tracks per artist (Spotify search → URIs)
- [x] "Because you listen to…" explanations and match rating

### Phase 3 — Frontend (done)
- [x] Festival search by name (lineups from Festival Dust)
- [x] Artist discovery cards with explanations
- [x] Playlist export (sticky button)
- [x] Saved discovery list

### Phase 4 — Polish
- [x] Fixed adventurous mode, 21 artists (slider and count dropdown dropped)
- [ ] Responsive, polished UI pass
- [ ] Record demo (no hosting; see decisions)

## Open questions / unverified

1. **Spotify `GET /artists/{id}` genres** — **resolved:** Spotify returns no `genres`, `popularity` or `followers` for artists. Use Last.fm tags and listener counts. Top artists (10), top/recent tracks, saved tracks (4,335), followed artists and search all work.
2. **Spotify app not registered yet** — redirect URI rules (loopback `127.0.0.1` vs `localhost`) unverified.
3. **Last.fm coverage** — only ~6 artists tested; some lineup acts will be missing or mismatched (e.g. `Jkyl & Hyde`).
4. **Lineup accuracy** — scraped from a third-party page; spot-check names and casing.
5. **Past festival** — Electric Forest 2026 already happened (June). Fine for a demo; decide whether to swap in 2027 when announced.
6. **Algorithm direction** — expand each of the user's artists via Last.fm and intersect with the lineup, or query similarity per lineup artist? Affects API call volume.
7. **Weights** — taste vs discovery weighting is untuned.
8. **Track → Spotify URI mapping** — search-based matching may pick wrong tracks.
9. **Demo limits** — Development Mode caps at 5 users and needs Premium; plan a recorded demo or screenshots.
10. **Hosting** — not decided (needs the server, so a static host alone won't work).
11. **Last.fm terms** — non-commercial use and attribution; confirm wording before publishing.
12. **EDMDb** — report the 500 to support if we want it as a later importer.
13. **Secrets** — the EDMDb key and Last.fm shared secret were pasted in chat; rotate them. Only the Last.fm API key is needed.

## Resolution plan for open questions

Run as short spikes, in this order. Each has a pass/fail check and a fallback, so nothing blocks Phase 1 for long.

| # | Spike | Resolves | What we do | Pass if | Fallback |
| --- | --- | --- | --- | --- | --- |
| S1 | Last.fm coverage | Q3, Q6 | Script runs `getinfo` + `getsimilar` for all 153 acts, writes `data/lastfm-cache.json`, reports misses and name mismatches | ≥ 85% of acts have a match and ≥ 5 similar artists | Hand-fix names via an alias map; Deezer `related` for the rest |
| S2 | Lineup verification | Q4 | Cross-check names against a second source (official site/poster); fix casing in an alias file | Names match in both sources | Mark unverified acts; exclude from results |
| S3 | Spotify setup | Q1, Q2, Q9 | **You:** register an app (Premium account), add redirect URI `http://127.0.0.1:5173/callback`, send me the Client ID (no secret needed for PKCE). Then test login, `/me/top/*`, `GET /artists/{id}` genres | Login works and top artists return | Use Last.fm tags if `genres` is missing |
| S4 | Algorithm design | Q6, Q7 | With S1 data, precompute the lineup similarity graph once (153 × ~50 neighbors), so a user request needs zero Last.fm calls. Build 3 fake taste profiles (e.g. Fred again../Overmono/Barry Can't Swim) and eyeball the top 10 | Results look plausible and non-obvious | Add tag-overlap score; widen to 2-hop neighbors |
| S5 | Track mapping | Q8 | With S3, search Spotify `artist:"X"` (limit 10) for 20 sample lineup acts; check artist-ID match before accepting tracks | ≥ 90% return the right artist | Use Last.fm `artist.gettoptracks` and search by track + artist |
| S6 | Terms and attribution | Q11 | Read Last.fm API terms; add attribution line to the footer/README | Non-commercial portfolio use is allowed | Remove Last.fm branding or switch to Deezer |
| S7 | EDMDb follow-up | Q12 | Retry the call; if still 500, send support the details. Optional importer only | n/a | Stay on curated JSON |

### Decisions needed from you
- **S1 result (2026-11-04):** 130 of 153 acts usable (85%). 11 not found (mostly local/community acts) and 12 with fewer than 5 similar artists. Data cached in `data/lastfm-cache.json` via `npm run coverage:lastfm`. Median Last.fm listeners are about 64k, so there's plenty of spread for a "smallness" signal.
- **S2:** skipped. Demo data, low value; acts with no Last.fm data are simply not recommended.
- **S3 (2026-11-04):** passed. Spotify PKCE login and all endpoint checks were green in Development Mode.
- **S4 (2026-11-04):** done. `src/recommend/` implements `taste^0.6 × discovery^0.4` with unit tests (`npm test`). Taste uses Last.fm similarity in both directions (lineup act → user artist and user artist → lineup act), weighted by the user's artist rank. Discovery is 0.7 × listener smallness + 0.3 × festival-likes smallness (log scale). Run `npm run s4:profiles` to eyeball 3 fake profiles; results were plausible (e.g. Fred again.. + Barry Can't Swim → Swimming Paul, Sammy Virji, Daniel Allan). Observed: discovery scores sit low (0.1–0.4) because the lineup has big headliners; consider rescaling later.
- **S6 (2026-11-04):** done. Last.fm terms allow non-commercial use only, require credit and links back to Last.fm, require written approval for public pages, cap stored data at 100 MB and forbid sub-licensing. Actions taken: attribution in the app footer and README; `data/lastfm-cache.json` is gitignored (regenerate with `npm run coverage:lastfm`); no public hosting. When artist pages are built, link each artist to `https://www.last.fm/music/<name>`.
- **S7:** dropped. EDMDb isn't used.
- **Hosting (Q10):** decided: no hosting for now; local run plus a recorded demo.
- **Q5 Festival date:** decided: keep Electric Forest 2026 as demo data.
- **Q7 Weights:** start with taste 0.6 / discovery 0.4, tune against S4's profiles.
- **EDMDb:** not needed; the key was removed from `.env` (revoke it at edmdb.net/account/developer).

### Housekeeping (anytime)
- Rotate the EDMDb key and Last.fm shared secret (both were pasted in chat); delete the unused `EDMDB_API_KEY` from `.env`.

### Order
**S5 result: passed (18/20, 90%).** Misses were tiny acts with no Spotify tracks (Daniel Donato's Cosmic Country, Detroit Party Band). Search order is used for track selection; acts with no tracks are skipped for playlists. Results for some acts include other artists' tracks, so filter by artist ID.

S1 → S2 (parallel, no input needed) → S3 (needs your Spotify Client ID) → S4 → S5 → S6/S7 in the background. S1 and S4 can proceed while you register the Spotify app.
