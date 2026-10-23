import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { errorMessage } from '../lib/errors'
import { DAY_MS } from '../lib/dates'
import { uuid } from '../lib/uuid'
import type { CalEvent, Item, List, Member, Membership } from '../lib/types'
import { useToast } from '../components/toast'
import { useHousehold } from './household'

type Row = { id: string }
type Table = 'lists' | 'items' | 'events'
export type EventInput = Omit<CalEvent, 'id' | 'household_id' | 'created_by' | 'created_at'>

interface DataState {
  householdId: string
  userId: string
  isOwner: boolean
  loading: boolean
  lists: List[]
  items: Item[]
  members: Member[]
  events: CalEvent[]
  nameOf: (userId: string | null) => string
  addList: (name: string) => Promise<List | null>
  renameList: (id: string, name: string) => Promise<boolean>
  deleteList: (id: string) => Promise<boolean>
  addItem: (listId: string, text: string) => Promise<void>
  toggleItem: (id: string) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  clearChecked: (listId: string) => Promise<void>
  setEventsRange: (fromDay: number, toDay: number) => void
  saveEvent: (input: EventInput, id?: string) => Promise<boolean>
  deleteEvent: (id: string) => Promise<boolean>
  refreshMembers: () => Promise<void>
  removeMember: (userId: string) => Promise<boolean>
}

const DataContext = createContext<DataState | null>(null)

const PAGE = 1000

/** Reads every row of a query, paging past PostgREST's max-rows limit. */
async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1)
    if (error) throw error
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGE) return out
  }
}

function toMap<T extends Row>(rows: T[]): Map<string, T> {
  return new Map(rows.map((r) => [r.id, r]))
}
function withRow<T extends Row>(map: Map<string, T>, row: T): Map<string, T> {
  const next = new Map(map)
  next.set(row.id, row)
  return next
}
function withoutRows<T extends Row>(map: Map<string, T>, ids: Iterable<string>): Map<string, T> {
  const gone = [...ids].filter((id) => map.has(id))
  if (!gone.length) return map
  const next = new Map(map)
  for (const id of gone) next.delete(id)
  return next
}

export function DataProvider({
  membership,
  userId,
  children,
}: {
  membership: Membership
  userId: string
  children: ReactNode
}) {
  const householdId = membership.household_id
  const toast = useToast()
  const { reload: reloadHouseholds } = useHousehold()

  const [loading, setLoading] = useState(true)
  const [lists, setLists] = useState<Map<string, List>>(new Map())
  const [items, setItems] = useState<Map<string, Item>>(new Map())
  const [events, setEvents] = useState<Map<string, CalEvent>>(new Map())
  const [members, setMembers] = useState<Member[]>([])

  // Latest state for mutation callbacks without re-creating them on every change.
  const listsRef = useRef(lists)
  const itemsRef = useRef(items)
  const eventsRef = useRef(events)
  const membersRef = useRef(members)
  listsRef.current = lists
  itemsRef.current = items
  eventsRef.current = events
  membersRef.current = members

  const fail = useCallback((err: unknown, what: string) => toast(`${what}: ${errorMessage(err)}`), [toast])

  // ---- fetching -----------------------------------------------------------

  const listsGen = useRef(0)
  const fetchListsAndItems = useCallback(async () => {
    const gen = ++listsGen.current
    try {
      const [l, i] = await Promise.all([
        fetchAll<List>((a, b) => supabase.from('lists').select('*').eq('household_id', householdId).order('id').range(a, b)),
        fetchAll<Item>((a, b) => supabase.from('items').select('*').eq('household_id', householdId).order('id').range(a, b)),
      ])
      if (gen !== listsGen.current) return
      setLists(toMap(l))
      setItems(toMap(i))
    } catch (err) {
      if (gen === listsGen.current) fail(err, "Couldn't load lists")
    } finally {
      if (gen === listsGen.current) setLoading(false)
    }
  }, [householdId, fail])

  const membersPending = useRef<Promise<void> | null>(null)
  const refreshMembers = useCallback(() => {
    membersPending.current ??= (async () => {
      try {
        const { data: rows, error } = await supabase
          .from('household_members')
          .select('user_id, role, joined_at')
          .eq('household_id', householdId)
          .order('joined_at')
        if (error) throw error
        const ms = (rows ?? []) as Omit<Member, 'display_name'>[]
        if (!ms.some((m) => m.user_id === userId)) {
          // We were removed from this household (or it was deleted).
          await reloadHouseholds()
          return
        }
        const { data: profiles, error: pErr } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', ms.map((m) => m.user_id))
        if (pErr) throw pErr
        const names = new Map((profiles ?? []).map((p) => [p.id as string, p.display_name as string | null]))
        setMembers(ms.map((m) => ({ ...m, display_name: names.get(m.user_id) ?? null })))
      } catch (err) {
        fail(err, "Couldn't load members")
      } finally {
        membersPending.current = null
      }
    })()
    return membersPending.current
  }, [householdId, userId, reloadHouseholds, fail])

  const range = useRef<{ from: number; to: number } | null>(null)
  const eventsGen = useRef(0)
  const fetchEvents = useCallback(async () => {
    if (!range.current) return
    const gen = ++eventsGen.current
    // Pad by a day each side: all-day events sit at UTC midnight, the range is local days.
    const fromIso = new Date((range.current.from - 1) * DAY_MS).toISOString()
    const toIso = new Date((range.current.to + 1) * DAY_MS).toISOString()
    try {
      const rows = await fetchAll<CalEvent>((a, b) =>
        supabase
          .from('events')
          .select('*')
          .eq('household_id', householdId)
          .lt('starts_at', toIso)
          .or(`repeat.neq.none,starts_at.gte."${fromIso}",ends_at.gte."${fromIso}"`)
          .order('id')
          .range(a, b),
      )
      if (gen === eventsGen.current) setEvents(toMap(rows))
    } catch (err) {
      if (gen === eventsGen.current) fail(err, "Couldn't load events")
    }
  }, [householdId, fail])

  const setEventsRange = useCallback(
    (from: number, to: number) => {
      const r = range.current
      if (r && r.from === from && r.to === to) return
      range.current = { from, to }
      void fetchEvents()
    },
    [fetchEvents],
  )

  const refetchAll = useCallback(() => {
    void fetchListsAndItems()
    void refreshMembers()
    void fetchEvents()
  }, [fetchListsAndItems, refreshMembers, fetchEvents])

  // ---- realtime -----------------------------------------------------------

  useEffect(() => {
    refetchAll()

    const apply = (table: Table, row: Row, deleted: boolean) => {
      if (table === 'lists') {
        setLists((m) => (deleted ? withoutRows(m, [row.id]) : withRow(m, row as List)))
        if (deleted) setItems((m) => withoutRows(m, [...m.values()].filter((i) => i.list_id === row.id).map((i) => i.id)))
      } else if (table === 'items') {
        setItems((m) => (deleted ? withoutRows(m, [row.id]) : withRow(m, row as Item)))
        const by = (row as Item).added_by
        if (!deleted && by && !membersRef.current.some((x) => x.user_id === by)) void refreshMembers()
      } else {
        setEvents((m) => (deleted ? withoutRows(m, [row.id]) : withRow(m, row as CalEvent)))
      }
    }

    const filter = `household_id=eq.${householdId}`
    const channel = supabase.channel(`household:${householdId}:${uuid()}`)
    for (const table of ['lists', 'items', 'events'] as const) {
      channel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter }, (p) => apply(table, p.new as Row, false))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter }, (p) => apply(table, p.new as Row, false))
        // DELETE can't be filtered server-side; it carries only the primary key.
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table }, (p) => {
          const id = (p.old as Partial<Row>).id
          if (id) apply(table, { id }, true)
        })
    }
    let subscribedOnce = false
    channel.subscribe((status) => {
      // Re-sync after every (re)connect so nothing missed while offline is lost.
      if (status === 'SUBSCRIBED') {
        if (subscribedOnce) refetchAll()
        subscribedOnce = true
      }
    })

    let hiddenAt = 0
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now()
      else if (hiddenAt && Date.now() - hiddenAt > 15_000) refetchAll()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      void supabase.removeChannel(channel)
    }
  }, [householdId, refetchAll, refreshMembers])

  // ---- lists --------------------------------------------------------------

  const addList = useCallback(
    async (name: string) => {
      const all = [...listsRef.current.values()]
      const list: List = {
        id: uuid(),
        household_id: householdId,
        name: name.trim(),
        position: all.reduce((max, l) => Math.max(max, l.position), -1) + 1,
        created_by: userId,
        created_at: new Date().toISOString(),
      }
      setLists((m) => withRow(m, list))
      const { data, error } = await supabase
        .from('lists')
        .insert({ id: list.id, household_id: list.household_id, name: list.name, position: list.position })
        .select()
        .single()
      if (error) {
        setLists((m) => withoutRows(m, [list.id]))
        fail(error, "Couldn't create list")
        return null
      }
      setLists((m) => withRow(m, data as List))
      return data as List
    },
    [householdId, userId, fail],
  )

  const renameList = useCallback(
    async (id: string, name: string) => {
      const prev = listsRef.current.get(id)
      if (!prev) return false
      setLists((m) => withRow(m, { ...prev, name: name.trim() }))
      const { error } = await supabase.from('lists').update({ name: name.trim() }).eq('id', id)
      if (error) {
        setLists((m) => withRow(m, prev))
        fail(error, "Couldn't rename list")
        return false
      }
      return true
    },
    [fail],
  )

  const deleteList = useCallback(
    async (id: string) => {
      const prev = listsRef.current.get(id)
      if (!prev) return false
      const prevItems = [...itemsRef.current.values()].filter((i) => i.list_id === id)
      setLists((m) => withoutRows(m, [id]))
      setItems((m) => withoutRows(m, prevItems.map((i) => i.id)))
      const { error } = await supabase.from('lists').delete().eq('id', id)
      if (error) {
        setLists((m) => withRow(m, prev))
        setItems((m) => prevItems.reduce((acc, i) => withRow(acc, i), m))
        fail(error, "Couldn't delete list")
        return false
      }
      // Events pointing at this list are detached by the database.
      setEvents((m) => {
        let next = m
        for (const ev of m.values()) if (ev.list_id === id) next = withRow(next, { ...ev, list_id: null })
        return next
      })
      return true
    },
    [fail],
  )

  // ---- items --------------------------------------------------------------

  const addItem = useCallback(
    async (listId: string, text: string) => {
      const item: Item = {
        id: uuid(),
        list_id: listId,
        household_id: householdId,
        text: text.trim(),
        done: false,
        done_at: null,
        added_by: userId,
        created_at: new Date().toISOString(),
      }
      setItems((m) => withRow(m, item))
      const { data, error } = await supabase
        .from('items')
        .insert({ id: item.id, list_id: listId, household_id: householdId, text: item.text })
        .select()
        .single()
      if (error) {
        setItems((m) => withoutRows(m, [item.id]))
        fail(error, `Couldn't add "${item.text}"`)
        return
      }
      setItems((m) => (m.has(item.id) ? withRow(m, data as Item) : m))
    },
    [householdId, userId, fail],
  )

  const toggleItem = useCallback(
    async (id: string) => {
      const prev = itemsRef.current.get(id)
      if (!prev) return
      const done = !prev.done
      const patch = { done, done_at: done ? new Date().toISOString() : null }
      setItems((m) => withRow(m, { ...prev, ...patch }))
      const { error } = await supabase.from('items').update(patch).eq('id', id)
      if (error) {
        setItems((m) => (m.has(id) ? withRow(m, prev) : m))
        fail(error, "Couldn't update item")
      }
    },
    [fail],
  )

  const deleteItem = useCallback(
    async (id: string) => {
      const prev = itemsRef.current.get(id)
      if (!prev) return
      setItems((m) => withoutRows(m, [id]))
      const { error } = await supabase.from('items').delete().eq('id', id)
      if (error) {
        setItems((m) => withRow(m, prev))
        fail(error, "Couldn't delete item")
      }
    },
    [fail],
  )

  const clearChecked = useCallback(
    async (listId: string) => {
      const done = [...itemsRef.current.values()].filter((i) => i.list_id === listId && i.done)
      if (!done.length) return
      const ids = done.map((i) => i.id)
      setItems((m) => withoutRows(m, ids))
      const { error } = await supabase.from('items').delete().in('id', ids)
      if (error) {
        setItems((m) => done.reduce((acc, i) => withRow(acc, i), m))
        fail(error, "Couldn't clear checked items")
      }
    },
    [fail],
  )

  // ---- events -------------------------------------------------------------

  const saveEvent = useCallback(
    async (input: EventInput, id?: string) => {
      const prev = id ? eventsRef.current.get(id) : undefined
      const ev: CalEvent = prev
        ? { ...prev, ...input }
        : { ...input, id: uuid(), household_id: householdId, created_by: userId, created_at: new Date().toISOString() }
      setEvents((m) => withRow(m, ev))
      const { data, error } = prev
        ? await supabase.from('events').update(input).eq('id', ev.id).select().single()
        : await supabase
            .from('events')
            .insert({ ...input, id: ev.id, household_id: householdId })
            .select()
            .single()
      if (error) {
        setEvents((m) => (prev ? withRow(m, prev) : withoutRows(m, [ev.id])))
        fail(error, "Couldn't save event")
        return false
      }
      setEvents((m) => (m.has(ev.id) ? withRow(m, data as CalEvent) : m))
      return true
    },
    [householdId, userId, fail],
  )

  const deleteEvent = useCallback(
    async (id: string) => {
      const prev = eventsRef.current.get(id)
      setEvents((m) => withoutRows(m, [id]))
      const { error } = await supabase.from('events').delete().eq('id', id)
      if (error) {
        if (prev) setEvents((m) => withRow(m, prev))
        fail(error, "Couldn't delete event")
        return false
      }
      return true
    },
    [fail],
  )

  // ---- members ------------------------------------------------------------

  const removeMember = useCallback(
    async (memberId: string) => {
      const { data, error } = await supabase
        .from('household_members')
        .delete()
        .eq('household_id', householdId)
        .eq('user_id', memberId)
        .select('user_id')
      if (error || !data?.length) {
        fail(error ?? new Error('Only an owner can remove members'), "Couldn't remove member")
        return false
      }
      setMembers((ms) => ms.filter((m) => m.user_id !== memberId))
      return true
    },
    [householdId, fail],
  )

  const nameOf = useCallback(
    (id: string | null) => {
      if (!id) return 'someone'
      return members.find((m) => m.user_id === id)?.display_name || 'a former member'
    },
    [members],
  )

  const value = useMemo<DataState>(
    () => ({
      householdId,
      userId,
      isOwner: membership.role === 'owner',
      loading,
      lists: [...lists.values()].sort(
        (a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at),
      ),
      items: [...items.values()],
      members,
      events: [...events.values()],
      nameOf,
      addList,
      renameList,
      deleteList,
      addItem,
      toggleItem,
      deleteItem,
      clearChecked,
      setEventsRange,
      saveEvent,
      deleteEvent,
      refreshMembers,
      removeMember,
    }),
    [
      householdId, userId, membership.role, loading, lists, items, members, events, nameOf,
      addList, renameList, deleteList, addItem, toggleItem, deleteItem, clearChecked,
      setEventsRange, saveEvent, deleteEvent, refreshMembers, removeMember,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataState {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside DataProvider')
  return ctx
}
