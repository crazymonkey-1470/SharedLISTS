import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useData } from '../state/data'
import { readLocal, writeLocal } from '../lib/storage'
import type { Item, List } from '../lib/types'
import { Button, InlineConfirm, Spinner } from '../components/ui'
import { CheckIcon, MoreIcon, PlusIcon, TrashIcon, XIcon } from '../components/icons'

const SUGGESTIONS = ['Groceries', 'House to-dos', 'Pharmacy']

export default function ListsPage() {
  const { listId } = useParams()
  const navigate = useNavigate()
  const { lists, items, loading, householdId, addList } = useData()
  const [creating, setCreating] = useState(false)
  const current = lists.find((l) => l.id === listId) ?? null
  const lastKey = `osl.lastList.${householdId}`

  // Keep the URL pointing at a real list: last used, else the first one.
  useEffect(() => {
    if (loading) return
    if (current) {
      writeLocal(lastKey, current.id)
      return
    }
    if (!lists.length) {
      if (listId) navigate('/lists', { replace: true })
      return
    }
    const last = readLocal(lastKey)
    navigate(`/lists/${(lists.find((l) => l.id === last) ?? lists[0]).id}`, { replace: true })
  }, [loading, current, lists, listId, lastKey, navigate])

  const openCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const i of items) if (!i.done) counts.set(i.list_id, (counts.get(i.list_id) ?? 0) + 1)
    return counts
  }, [items])

  async function create(name: string) {
    const list = await addList(name)
    if (list) {
      setCreating(false)
      navigate(`/lists/${list.id}`)
    }
  }

  if (loading && !lists.length) {
    return (
      <div className="grid h-full place-items-center text-muted">
        <Spinner />
      </div>
    )
  }

  if (!lists.length) {
    return <FirstList onCreate={create} />
  }

  return (
    <div className="flex h-full flex-col">
      <ListTabs
        lists={lists}
        currentId={current?.id ?? null}
        counts={openCounts}
        onSelect={(id) => navigate(`/lists/${id}`, { replace: true })}
        onNew={() => setCreating(true)}
      />
      {creating && <NewListForm onCreate={create} onCancel={() => setCreating(false)} />}
      {current && <ListView key={current.id} list={current} />}
    </div>
  )
}

function ListTabs({
  lists,
  currentId,
  counts,
  onSelect,
  onNew,
}: {
  lists: List[]
  currentId: string | null
  counts: Map<string, number>
  onSelect: (id: string) => void
  onNew: () => void
}) {
  const selectedRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [currentId])

  return (
    <div className="shrink-0 border-b border-line bg-bg">
      <div role="tablist" aria-label="Lists" className="no-scrollbar flex gap-1.5 overflow-x-auto px-3 py-2.5">
        {lists.map((l) => {
          const selected = l.id === currentId
          const count = counts.get(l.id) ?? 0
          return (
            <button
              key={l.id}
              ref={selected ? selectedRef : undefined}
              role="tab"
              aria-selected={selected}
              onClick={() => onSelect(l.id)}
              className={`flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[15px] font-semibold whitespace-nowrap transition ${
                selected ? 'bg-fg text-bg' : 'bg-surface text-fg ring-1 ring-line hover:bg-surface-2'
              }`}
            >
              {l.name}
              {count > 0 && (
                <span
                  className={`min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-bold ${
                    selected ? 'bg-bg/20 text-bg' : 'bg-accent-soft text-accent'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
        <button
          onClick={onNew}
          className="flex min-h-10 shrink-0 items-center gap-1 rounded-full px-4 text-[15px] font-semibold whitespace-nowrap border border-dashed border-accent/50 text-accent hover:bg-accent-soft"
        >
          <PlusIcon size={18} /> List
        </button>
      </div>
    </div>
  )
}

function NewListForm({ onCreate, onCancel }: { onCreate: (name: string) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    await onCreate(name)
    setBusy(false)
  }
  return (
    <form onSubmit={submit} className="flex shrink-0 gap-2 border-b border-line bg-surface px-3 py-3">
      <input
        className="field"
        autoFocus
        maxLength={60}
        placeholder="New list, e.g. ShopRite"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      />
      <Button type="submit" variant="primary" busy={busy} disabled={!name.trim()}>
        Create
      </Button>
      <Button variant="ghost" onClick={onCancel} aria-label="Cancel" className="px-3">
        <XIcon />
      </Button>
    </form>
  )
}

function FirstList({ onCreate }: { onCreate: (name: string) => Promise<void> }) {
  const [name, setName] = useState('')
  return (
    <div className="h-full overflow-y-auto px-5 py-10">
      <div className="mx-auto max-w-sm text-center">
        <h2 className="text-xl font-semibold">Start your first list</h2>
        <p className="mt-1 text-[15px] text-muted">One per store or chore works well — everyone in the household sees it.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => void onCreate(s)}
              className="min-h-10 rounded-full bg-surface px-4 text-[15px] font-semibold ring-1 ring-line hover:bg-surface-2"
            >
              + {s}
            </button>
          ))}
        </div>
        <form
          className="mt-6 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) void onCreate(name)
          }}
        >
          <input className="field" maxLength={60} placeholder="Or name it yourself" value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" variant="primary" disabled={!name.trim()}>
            Create
          </Button>
        </form>
      </div>
    </div>
  )
}

type HeaderMode = 'idle' | 'menu' | 'rename' | 'delete'

function ListView({ list }: { list: List }) {
  const { items, addItem, toggleItem, deleteItem, clearChecked, renameList, deleteList } = useData()
  const [mode, setMode] = useState<HeaderMode>('idle')
  const [busy, setBusy] = useState(false)

  const { open, done } = useMemo(() => {
    const mine = items.filter((i) => i.list_id === list.id)
    return {
      open: mine.filter((i) => !i.done).sort((a, b) => a.created_at.localeCompare(b.created_at)),
      done: mine.filter((i) => i.done).sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? '')),
    }
  }, [items, list.id])

  async function onDelete() {
    setBusy(true)
    const ok = await deleteList(list.id)
    if (!ok) setBusy(false)
  }

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-4 pt-4 pb-2">
          {mode === 'rename' ? (
            <RenameForm list={list} onDone={() => setMode('idle')} onSave={(name) => renameList(list.id, name)} />
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="min-w-0 flex-1 truncate text-xl font-bold tracking-tight">{list.name}</h2>
              <span className="text-sm text-muted">{open.length} to go</span>
              <button
                aria-label="List options"
                aria-expanded={mode === 'menu'}
                onClick={() => setMode(mode === 'menu' ? 'idle' : 'menu')}
                className="-mr-2 grid size-11 place-items-center rounded-full text-muted hover:bg-surface-2"
              >
                <MoreIcon />
              </button>
            </div>
          )}
          {mode === 'menu' && (
            <div className="mt-2 flex gap-2">
              <Button className="flex-1" onClick={() => setMode('rename')}>
                Rename list
              </Button>
              <Button className="flex-1 text-danger" onClick={() => setMode('delete')}>
                Delete list
              </Button>
            </div>
          )}
          {mode === 'delete' && (
            <div className="mt-2">
              <InlineConfirm
                message={
                  <>
                    Delete <strong>{list.name}</strong>
                    {open.length + done.length > 0 ? ` and its ${open.length + done.length} item${open.length + done.length === 1 ? '' : 's'}` : ''} for
                    everyone?
                  </>
                }
                confirmLabel="Delete list"
                busy={busy}
                onConfirm={() => void onDelete()}
                onCancel={() => setMode('idle')}
              />
            </div>
          )}
        </div>

        {open.length === 0 && done.length === 0 && (
          <p className="px-4 py-10 text-center text-[15px] text-muted">Nothing here yet. Add the first item below.</p>
        )}
        {open.length === 0 && done.length > 0 && (
          <p className="px-4 py-6 text-center text-[15px] text-muted">All done! 🎉</p>
        )}

        <ul className="divide-y divide-line">
          {open.map((item) => (
            <ItemRow key={item.id} item={item} onToggle={toggleItem} onDelete={deleteItem} />
          ))}
        </ul>

        {done.length > 0 && (
          <section className="mt-4 pb-6">
            <div className="flex items-center justify-between px-4 py-2">
              <h3 className="text-sm font-semibold tracking-wide text-muted uppercase">Done · {done.length}</h3>
              <button
                onClick={() => void clearChecked(list.id)}
                className="min-h-10 rounded-lg px-2 text-sm font-semibold text-accent hover:bg-accent-soft"
              >
                Clear checked
              </button>
            </div>
            <ul className="divide-y divide-line">
              {done.map((item) => (
                <ItemRow key={item.id} item={item} onToggle={toggleItem} onDelete={deleteItem} />
              ))}
            </ul>
          </section>
        )}
      </div>
      <AddItemBar listName={list.name} onAdd={(text) => addItem(list.id, text)} />
    </>
  )
}

function RenameForm({ list, onSave, onDone }: { list: List; onSave: (name: string) => Promise<boolean>; onDone: () => void }) {
  const [name, setName] = useState(list.name)
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    if (name.trim() === list.name) return onDone()
    setBusy(true)
    const ok = await onSave(name)
    setBusy(false)
    if (ok) onDone()
  }
  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        className="field"
        autoFocus
        maxLength={60}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onDone()}
        aria-label="List name"
      />
      <Button type="submit" variant="primary" busy={busy} disabled={!name.trim()}>
        Save
      </Button>
      <Button variant="ghost" onClick={onDone} aria-label="Cancel" className="px-3">
        <XIcon />
      </Button>
    </form>
  )
}

function ItemRow({ item, onToggle, onDelete }: { item: Item; onToggle: (id: string) => void; onDelete: (id: string) => void }) {
  const { nameOf } = useData()
  return (
    <li className="flex items-stretch bg-surface">
      <button
        role="checkbox"
        aria-checked={item.done}
        onClick={() => onToggle(item.id)}
        className="flex min-h-16 min-w-0 flex-1 items-center gap-3.5 py-3 pl-4 text-left active:bg-surface-2"
      >
        <span
          className={`grid size-7 shrink-0 place-items-center rounded-full border-2 transition ${
            item.done ? 'border-accent bg-accent text-accent-fg' : 'border-muted/50'
          }`}
        >
          {item.done && <CheckIcon size={16} strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-[17px] leading-snug break-words ${item.done ? 'text-muted line-through' : ''}`}>{item.text}</span>
          <span className="mt-0.5 block text-xs text-muted">Added by {nameOf(item.added_by)}</span>
        </span>
      </button>
      <button
        aria-label={`Delete ${item.text}`}
        onClick={() => onDelete(item.id)}
        className="grid w-14 shrink-0 place-items-center text-muted/70 hover:text-danger active:bg-surface-2"
      >
        <TrashIcon size={18} />
      </button>
    </li>
  )
}

function AddItemBar({ listName, onAdd }: { listName: string; onAdd: (text: string) => Promise<void> }) {
  const [text, setText] = useState('')
  function submit(e: FormEvent) {
    e.preventDefault()
    const value = text.trim()
    if (!value) return
    setText('')
    void onAdd(value)
  }
  return (
    <form onSubmit={submit} className="flex shrink-0 gap-2 border-t border-line bg-surface px-3 py-2.5">
      <input
        className="field"
        data-hide-nav
        maxLength={500}
        autoComplete="off"
        enterKeyHint="enter"
        placeholder={`Add to ${listName}…`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label={`Add item to ${listName}`}
      />
      <button
        type="submit"
        aria-label="Add item"
        disabled={!text.trim()}
        // keep the keyboard open for rapid entry
        onMouseDown={(e) => e.preventDefault()}
        className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent text-accent-fg transition disabled:opacity-40"
      >
        <PlusIcon size={24} />
      </button>
    </form>
  )
}
