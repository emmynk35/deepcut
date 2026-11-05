import { getAccessToken } from './auth.ts'

export async function spotifyPost<T>(path: string, body: unknown): Promise<T> {
  const token = getAccessToken()
  if (!token) throw new SpotifyApiError('Not logged in', 401)
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new SpotifyApiError(`POST ${path} failed (${res.status})`, res.status)
  return res.json()
}

export class SpotifyApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function spotifyGet<T>(path: string): Promise<T> {
  const token = getAccessToken()
  if (!token) throw new SpotifyApiError('Not logged in', 401)
  let res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 429) {
    const wait = Number(res.headers.get('Retry-After') ?? 1)
    await new Promise((resolve) => setTimeout(resolve, Math.min(wait, 10) * 1000))
    res = await fetch(`https://api.spotify.com/v1${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  }
  if (!res.ok) throw new SpotifyApiError(`GET ${path} failed (${res.status})`, res.status)
  return res.json()
}
