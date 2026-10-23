import { useState, type FormEvent } from 'react'
import { useAuth } from '../state/auth'
import { errorMessage } from '../lib/errors'
import { Button, CenteredPage } from '../components/ui'

export default function NamePage() {
  const { saveDisplayName, signOut, email } = useAuth()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      await saveDisplayName(name)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <CenteredPage>
      <form onSubmit={onSubmit} className="rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-line">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">Welcome</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">What should we call you?</h1>
        <p className="mt-1 text-[15px] text-muted">Your household sees this next to things you add.</p>
        <input
          className="field mt-5"
          autoFocus
          autoComplete="given-name"
          maxLength={60}
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <Button type="submit" variant="primary" busy={busy} disabled={!name.trim()} className="mt-4 w-full">
          Continue
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        Signed in as {email}.{' '}
        <button type="button" className="font-medium text-fg underline" onClick={() => void signOut()}>
          Sign out
        </button>
      </p>
    </CenteredPage>
  )
}
