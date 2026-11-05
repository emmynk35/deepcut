import express from 'express'
import { FestivalError, getFestivalLineup, searchFestivals } from './festivals.ts'
import { getInfo, getSimilar, LastFmError } from './lastfm.ts'
import { recommend } from './recommend.ts'

const PORT = Number(process.env.PORT ?? 3001)
const apiKey = process.env.LASTFM_API_KEY
if (!apiKey) {
  console.error('LASTFM_API_KEY is missing. Copy .env.example to .env and set it.')
  process.exit(1)
}

const app = express()

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/festivals/search', async (req, res, next) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : ''
  try {
    res.json(q ? await searchFestivals(q) : [])
  } catch (err) {
    next(err)
  }
})

app.get('/api/festivals/:slug', async (req, res, next) => {
  try {
    res.json(await getFestivalLineup(req.params.slug))
  } catch (err) {
    next(err)
  }
})

function artistParam(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

app.get('/api/artists/similar', async (req, res, next) => {
  const artist = artistParam(req.query.name)
  if (!artist) return void res.status(400).json({ error: 'name is required' })
  try {
    res.json(await getSimilar(apiKey, artist))
  } catch (err) {
    next(err)
  }
})

app.get('/api/artists/info', async (req, res, next) => {
  const artist = artistParam(req.query.name)
  if (!artist) return void res.status(400).json({ error: 'name is required' })
  try {
    res.json(await getInfo(apiKey, artist))
  } catch (err) {
    next(err)
  }
})

app.post('/api/recommend', express.json({ limit: '1mb' }), async (req, res, next) => {
  const { taste, familiar, limit, discovery, artists } = req.body ?? {}
  const validArtists =
    Array.isArray(artists) &&
    artists.length > 0 &&
    artists.length <= 400 &&
    artists.every(
      (a) =>
        typeof a?.name === 'string' &&
        a.name.trim() !== '' &&
        a.name.length <= 100 &&
        (a.likes === undefined || typeof a.likes === 'number'),
    )
  if (!validArtists) return void res.status(400).json({ error: 'artists (1-400 names) are required' })
  const validTaste =
    Array.isArray(taste) &&
    taste.length > 0 &&
    taste.length <= 50 &&
    taste.every((t) => typeof t?.name === 'string' && typeof t?.weight === 'number')
  if (!validTaste || !Array.isArray(familiar) || !familiar.every((f) => typeof f === 'string')) {
    return void res.status(400).json({ error: 'taste and familiar are required' })
  }
  try {
    const count = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 50) : 10
    const intensity = typeof discovery === 'number' ? Math.min(Math.max(discovery, 0), 1) : 0.5
    res.json(await recommend(apiKey, artists, taste, familiar, count, intensity))
  } catch (err) {
    next(err)
  }
})

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof LastFmError || err instanceof FestivalError) {
    return void res.status(err.status).json({ error: err.message })
  }
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, '127.0.0.1', () => {
  console.log(`DeepCut API listening on http://127.0.0.1:${PORT}`)
})
