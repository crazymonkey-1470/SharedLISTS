import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { errorMessage } from '../lib/errors'
import { readLocal, writeLocal } from '../lib/storage'
import type { Membership } from '../lib/types'
import { useAuth } from './auth'

interface HouseholdState {
  ready: boolean
  error: string | null
  memberships: Membership[]
  active: Membership | null
  setActive: (householdId: string) => void
  reload: () => Promise<void>
  createHousehold: (name: string) => Promise<string>
  renameHousehold: (householdId: string, name: string) => Promise<void>
}

const HouseholdContext = createContext<HouseholdState | null>(null)
const ACTIVE_KEY = 'osl.household'

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [activeId, setActiveId] = useState<string | null>(() => readLocal(ACTIVE_KEY))

  const reload = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase
      .from('household_members')
      .select('household_id, role, joined_at, household:households(id, name, created_by, created_at)')
      .eq('user_id', userId)
      .order('joined_at')
    if (error) setError(errorMessage(error))
    else {
      setError(null)
      setMemberships(((data ?? []) as unknown as Membership[]).filter((m) => m.household))
    }
    setReady(true)
  }, [userId])

  useEffect(() => {
    void reload()
  }, [reload])

  const setActive = useCallback((householdId: string) => {
    writeLocal(ACTIVE_KEY, householdId)
    setActiveId(householdId)
  }, [])

  const createHousehold = useCallback(
    async (name: string) => {
      const { data, error } = await supabase.rpc('create_household', { name: name.trim() })
      if (error) throw error
      const id = data as string
      setActive(id)
      await reload()
      return id
    },
    [reload, setActive],
  )

  const renameHousehold = useCallback(async (householdId: string, name: string) => {
    const { data, error } = await supabase
      .from('households')
      .update({ name: name.trim() })
      .eq('id', householdId)
      .select('id, name')
    if (error) throw error
    if (!data?.length) throw new Error('Only an owner can rename the household')
    setMemberships((ms) =>
      ms.map((m) => (m.household_id === householdId ? { ...m, household: { ...m.household, name: name.trim() } } : m)),
    )
  }, [])

  const active = useMemo(
    () => memberships.find((m) => m.household_id === activeId) ?? memberships[0] ?? null,
    [memberships, activeId],
  )

  return (
    <HouseholdContext.Provider
      value={{ ready, error, memberships, active, setActive, reload, createHousehold, renameHousehold }}
    >
      {children}
    </HouseholdContext.Provider>
  )
}

export function useHousehold(): HouseholdState {
  const ctx = useContext(HouseholdContext)
  if (!ctx) throw new Error('useHousehold must be used inside HouseholdProvider')
  return ctx
}
