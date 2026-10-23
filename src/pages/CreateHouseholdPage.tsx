import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../state/auth'
import { useHousehold } from '../state/household'
import { errorMessage } from '../lib/errors'
import { Button, CenteredPage } from '../components/ui'

export default function CreateHouseholdPage() {
  const { profile, signOut } = useAuth()
  const { createHousehold } = useHousehold()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      await createHousehold(name)
      navigate('/lists', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <CenteredPage>
      <form onSubmit={onSubmit} className="rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-line">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">Hi {profile?.display_name}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Name your household</h1>
        <p className="mt-1 text-[15px] text-muted">You can invite everyone else once it's set up.</p>
        <input
          className="field mt-5"
          autoFocus
          maxLength={80}
          placeholder="The Jobsons"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <Button type="submit" variant="primary" busy={busy} disabled={!name.trim()} className="mt-4 w-full">
          Create household
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        Joining someone else's household? Open the invite link they sent you.
      </p>
      <p className="mt-2 text-center text-sm">
        <button type="button" className="font-medium text-muted underline" onClick={() => void signOut()}>
          Sign out
        </button>
      </p>
    </CenteredPage>
  )
}
