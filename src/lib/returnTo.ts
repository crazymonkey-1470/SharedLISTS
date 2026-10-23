// Remembers where a signed-out user started (e.g. /join/abc) in case the magic
// link lands on the Site URL instead of the exact page.
const KEY = 'osl.returnTo'
const MAX_AGE_MS = 2 * 60 * 60 * 1000

export function saveReturnTo(path: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }))
  } catch {
    /* storage unavailable */
  }
}

export function takeReturnTo(): string | null {
  try {
    const raw = localStorage.getItem(KEY)
    localStorage.removeItem(KEY)
    if (!raw) return null
    const { path, at } = JSON.parse(raw) as { path: string; at: number }
    if (Date.now() - at > MAX_AGE_MS || typeof path !== 'string' || !path.startsWith('/')) return null
    return path
  } catch {
    return null
  }
}
