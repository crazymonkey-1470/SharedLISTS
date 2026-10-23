import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { errorMessage } from '../lib/errors'
import { writeLocal } from '../lib/storage'
import type { Profile } from '../lib/types'

interface AuthState {
  ready: boolean
  session: Session | null
  userId: string | null
  email: string | null
  profile: Profile | null
  profileReady: boolean
  profileError: string | null
  reloadProfile: () => void
  saveDisplayName: (name: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileReady, setProfileReady] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileNonce, setProfileNonce] = useState(0)
  const userId = session?.user.id ?? null

  useEffect(() => {
    // INITIAL_SESSION fires after any magic-link tokens in the URL are processed.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setReady(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    setProfile(null)
    setProfileReady(false)
    setProfileError(null)
    if (!userId) return
    let cancelled = false
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setProfileError(errorMessage(error))
        else {
          setProfile(data as Profile | null)
          setProfileReady(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [userId, profileNonce])

  const reloadProfile = useCallback(() => setProfileNonce((n) => n + 1), [])

  const saveDisplayName = useCallback(
    async (name: string) => {
      if (!userId) throw new Error('Not signed in')
      const { data, error } = await supabase
        .from('profiles')
        .upsert({ id: userId, display_name: name.trim() })
        .select()
        .single()
      if (error) throw error
      setProfile(data as Profile)
    },
    [userId],
  )

  const signOut = useCallback(async () => {
    writeLocal('osl.household', null)
    await supabase.auth.signOut()
  }, [])

  return (
    <AuthContext.Provider
      value={{
        ready,
        session,
        userId,
        email: session?.user.email ?? null,
        profile,
        profileReady,
        profileError,
        reloadProfile,
        saveDisplayName,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
