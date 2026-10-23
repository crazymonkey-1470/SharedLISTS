import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useAuth } from '../state/auth'
import { useHousehold } from '../state/household'
import { useData } from '../state/data'
import { supabase } from '../lib/supabase'
import { copyText } from '../lib/clipboard'
import { errorMessage } from '../lib/errors'
import { formatShortDate } from '../lib/dates'
import { getThemePref, setThemePref, type ThemePref } from '../lib/theme'
import type { Invite } from '../lib/types'
import { useToast } from '../components/toast'
import { Button, InlineConfirm, Segmented } from '../components/ui'
import { CheckIcon, CopyIcon, ShareIcon } from '../components/icons'

export default function SettingsPage() {
  const { signOut, email } = useAuth()
  const { refreshMembers } = useData()
  const [theme, setTheme] = useState<ThemePref>(getThemePref)

  useEffect(() => {
    void refreshMembers()
  }, [refreshMembers])

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-5 px-4 py-5">
        <HouseholdCard />
        <MembersCard />
        <InvitesCard />
        <YouCard />
        <Card title="Appearance">
          <Segmented
            label="Theme"
            value={theme}
            onChange={(t) => {
              setTheme(t)
              setThemePref(t)
            }}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </Card>
        <div className="pb-6 text-center">
          <Button variant="secondary" className="w-full" onClick={() => void signOut()}>
            Sign out
          </Button>
          <p className="mt-2 text-xs text-muted">Signed in as {email}</p>
        </div>
      </div>
    </div>
  )
}

function Card({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-2xl bg-surface p-4 ring-1 ring-line">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function HouseholdCard() {
  const { memberships, active, setActive, renameHousehold } = useHousehold()
  const { isOwner } = useData()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(active?.household.name ?? '')
  const [busy, setBusy] = useState(false)
  if (!active) return null

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!active || !name.trim()) return
    setBusy(true)
    try {
      await renameHousehold(active.household_id, name)
      setEditing(false)
    } catch (err) {
      toast(`Couldn't rename: ${errorMessage(err)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card
      title="Household"
      action={
        isOwner && !editing ? (
          <button
            className="min-h-9 rounded-lg px-2 text-sm font-semibold text-accent hover:bg-accent-soft"
            onClick={() => {
              setName(active.household.name)
              setEditing(true)
            }}
          >
            Rename
          </button>
        ) : undefined
      }
    >
      {editing ? (
        <form onSubmit={save} className="flex gap-2">
          <input className="field" autoFocus maxLength={80} value={name} onChange={(e) => setName(e.target.value)} aria-label="Household name" />
          <Button type="submit" variant="primary" busy={busy} disabled={!name.trim()}>
            Save
          </Button>
          <Button variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </form>
      ) : (
        <p className="text-xl font-bold tracking-tight">{active.household.name}</p>
      )}
      {memberships.length > 1 && (
        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-medium text-muted">Switch household</span>
          <select className="field" value={active.household_id} onChange={(e) => setActive(e.target.value)}>
            {memberships.map((m) => (
              <option key={m.household_id} value={m.household_id}>
                {m.household.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </Card>
  )
}

function MembersCard() {
  const { members, userId, isOwner, removeMember } = useData()
  const [confirming, setConfirming] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function remove(id: string) {
    setBusy(true)
    await removeMember(id)
    setBusy(false)
    setConfirming(null)
  }

  return (
    <Card title={`Members · ${members.length}`}>
      <ul className="divide-y divide-line">
        {members.map((m) => {
          const name = m.display_name || 'Unnamed'
          return (
            <li key={m.user_id} className="py-2.5">
              <div className="flex min-h-11 items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft font-bold text-accent">
                  {name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {name}
                    {m.user_id === userId && <span className="font-normal text-muted"> (you)</span>}
                  </span>
                  <span className="block text-xs text-muted">
                    {m.role === 'owner' ? 'Owner' : 'Member'} · joined {formatShortDate(new Date(m.joined_at))}
                  </span>
                </span>
                {isOwner && m.role === 'member' && m.user_id !== userId && confirming !== m.user_id && (
                  <button
                    className="min-h-10 rounded-lg px-2 text-sm font-semibold text-danger hover:bg-danger-soft"
                    onClick={() => setConfirming(m.user_id)}
                  >
                    Remove
                  </button>
                )}
              </div>
              {confirming === m.user_id && (
                <div className="mt-2">
                  <InlineConfirm
                    message={
                      <>
                        Remove <strong>{name}</strong> from the household? They'll lose access to all lists and the calendar.
                      </>
                    }
                    confirmLabel="Remove"
                    busy={busy}
                    onConfirm={() => void remove(m.user_id)}
                    onCancel={() => setConfirming(null)}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function inviteUrl(token: string) {
  return `${window.location.origin}/join/${token}`
}

function InvitesCard() {
  const { householdId, isOwner } = useData()
  const toast = useToast()
  const [invites, setInvites] = useState<Invite[]>([])
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('invites')
      .select('*')
      .eq('household_id', householdId)
      .eq('revoked', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
    if (error) toast(`Couldn't load invites: ${errorMessage(error)}`)
    else setInvites((data ?? []) as Invite[])
  }, [householdId, toast])

  useEffect(() => {
    if (isOwner) void load()
  }, [isOwner, load])

  if (!isOwner) {
    return (
      <Card title="Invite">
        <p className="text-[15px] text-muted">Ask the household owner for an invite link to add someone.</p>
      </Card>
    )
  }

  async function create() {
    setCreating(true)
    const { data, error } = await supabase.from('invites').insert({ household_id: householdId }).select().single()
    setCreating(false)
    if (error) return toast(`Couldn't create invite: ${errorMessage(error)}`)
    setInvites((all) => [data as Invite, ...all])
    void copy(data as Invite)
  }

  async function copy(invite: Invite) {
    const ok = await copyText(inviteUrl(invite.token))
    if (ok) {
      setCopied(invite.id)
      setTimeout(() => setCopied((c) => (c === invite.id ? null : c)), 2000)
    } else {
      toast('Copy failed — press and hold the link to copy it.', 'info')
    }
  }

  async function share(invite: Invite) {
    try {
      await navigator.share({ title: 'Join our household on Our Shared Lists', url: inviteUrl(invite.token) })
    } catch {
      /* cancelled */
    }
  }

  async function revoke(invite: Invite) {
    setInvites((all) => all.filter((i) => i.id !== invite.id))
    const { data, error } = await supabase.from('invites').update({ revoked: true }).eq('id', invite.id).select('id')
    if (error || !data?.length) {
      setInvites((all) => [invite, ...all])
      toast(`Couldn't revoke: ${errorMessage(error ?? 'not allowed')}`)
    }
  }

  const canShare = typeof navigator.share === 'function'

  return (
    <Card title="Invite">
      <p className="mb-3 text-[15px] text-muted">Anyone with a link can join this household until it expires (7 days) or you revoke it.</p>
      <Button variant="primary" className="w-full" busy={creating} onClick={() => void create()}>
        Create invite link
      </Button>
      {invites.length > 0 && (
        <ul className="mt-4 space-y-3">
          {invites.map((inv) => (
            <li key={inv.id} className="rounded-xl bg-surface-2 p-3">
              <input
                readOnly
                value={inviteUrl(inv.token)}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Invite link"
                className="w-full truncate bg-transparent font-mono text-sm outline-none"
              />
              <div className="mt-2 flex items-center gap-2">
                <span className="flex-1 text-xs text-muted">Expires {new Date(inv.expires_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                <Button className="min-h-10 bg-surface px-3" onClick={() => void copy(inv)}>
                  {copied === inv.id ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
                  {copied === inv.id ? 'Copied!' : 'Copy'}
                </Button>
                {canShare && (
                  <Button className="min-h-10 bg-surface px-3" onClick={() => void share(inv)} aria-label="Share invite link">
                    <ShareIcon size={16} />
                  </Button>
                )}
                <Button variant="ghost" className="min-h-10 px-3 text-danger" onClick={() => void revoke(inv)}>
                  Revoke
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function YouCard() {
  const { profile, saveDisplayName } = useAuth()
  const { refreshMembers } = useData()
  const toast = useToast()
  const [name, setName] = useState(profile?.display_name ?? '')
  const [busy, setBusy] = useState(false)
  const dirty = name.trim() !== (profile?.display_name ?? '') && name.trim().length > 0

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await saveDisplayName(name)
      await refreshMembers()
    } catch (err) {
      toast(`Couldn't save name: ${errorMessage(err)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Your name">
      <form onSubmit={save} className="flex gap-2">
        <input className="field" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} aria-label="Your name" />
        <Button type="submit" variant="primary" busy={busy} disabled={!dirty}>
          Save
        </Button>
      </form>
    </Card>
  )
}
