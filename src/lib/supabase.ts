import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && anonKey)

// A failed magic link comes back as #error=...&error_description=...; grab it
// before the auth client looks at the URL so the sign-in screen can show it.
function readAuthErrorFromHash(): string | null {
  if (typeof window === 'undefined' || !window.location.hash.includes('error')) return null
  const params = new URLSearchParams(window.location.hash.slice(1))
  const message = params.get('error_description') || params.get('error')
  if (!message) return null
  history.replaceState(null, '', window.location.pathname + window.location.search)
  return message.replace(/\+/g, ' ')
}

export const initialAuthError = readAuthErrorFromHash()

export const supabase = createClient(url || 'http://localhost', anonKey || 'missing-anon-key', {
  auth: {
    // Implicit flow so a magic link works even when opened in a different
    // browser than the one that requested it (e.g. mail app vs. home-screen app).
    flowType: 'implicit',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
})
