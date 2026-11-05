const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined
const REDIRECT_URI = `${window.location.origin}/callback`
const SCOPES = [
  'user-top-read',
  'user-read-recently-played',
  'user-library-read',
  'user-follow-read',
  'playlist-modify-public',
  'playlist-modify-private',
]

const VERIFIER_KEY = 'spotify_code_verifier'
const TOKEN_KEY = 'spotify_token'

interface StoredToken {
  accessToken: string
  expiresAt: number
}

function base64Url(bytes: ArrayBuffer | Uint8Array): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function sha256(text: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
}

export async function login(): Promise<void> {
  if (!CLIENT_ID) throw new Error('VITE_SPOTIFY_CLIENT_ID is not set')
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(64)))
  sessionStorage.setItem(VERIFIER_KEY, verifier)

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES.join(' '),
    code_challenge_method: 'S256',
    code_challenge: base64Url(await sha256(verifier)),
  })
  window.location.assign(`https://accounts.spotify.com/authorize?${params}`)
}

// Returns true when the current URL was an OAuth callback and a token was stored.
export async function handleCallback(): Promise<boolean> {
  if (window.location.pathname !== '/callback') return false
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const verifier = sessionStorage.getItem(VERIFIER_KEY)
  window.history.replaceState({}, '', '/')
  if (params.get('error')) throw new Error(`Spotify login failed: ${params.get('error')}`)
  if (!code || !verifier || !CLIENT_ID) return false

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  })
  if (!res.ok) throw new Error(`Token exchange failed (${res.status})`)
  const body = await res.json()
  const token: StoredToken = {
    accessToken: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000,
  }
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify(token))
  sessionStorage.removeItem(VERIFIER_KEY)
  return true
}

export function getAccessToken(): string | null {
  const raw = sessionStorage.getItem(TOKEN_KEY)
  if (!raw) return null
  const token: StoredToken = JSON.parse(raw)
  return token.expiresAt > Date.now() ? token.accessToken : null
}

export function logout(): void {
  sessionStorage.removeItem(TOKEN_KEY)
}
