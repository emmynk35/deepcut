import { getAccessToken } from './auth.ts'

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
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new SpotifyApiError(`GET ${path} failed (${res.status})`, res.status)
  return res.json()
}
