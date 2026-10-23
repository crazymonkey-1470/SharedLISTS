import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { supabase } from '../lib/supabase'
import { errorMessage } from '../lib/errors'
import { useHousehold } from '../state/household'
import { CenteredPage, Splash } from '../components/ui'

export default function JoinPage() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const { reload, setActive, memberships } = useHousehold()
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    void (async () => {
      const { data, error } = await supabase.rpc('accept_invite', { token })
      if (error) {
        setError(errorMessage(error))
        return
      }
      setActive(data as string)
      await reload()
      navigate('/lists', { replace: true })
    })()
  }, [token, reload, setActive, navigate])

  if (!error) return <Splash label="Joining household…" />

  return (
    <CenteredPage>
      <div className="rounded-3xl bg-surface p-6 text-center shadow-sm ring-1 ring-line">
        <h1 className="text-xl font-semibold">Couldn't join</h1>
        <p className="mt-2 text-[15px] text-muted">{error}</p>
        <p className="mt-2 text-[15px] text-muted">Ask whoever invited you for a fresh link.</p>
        <Link
          to="/lists"
          replace
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-accent px-4 font-semibold text-accent-fg"
        >
          {memberships.length ? 'Go to my lists' : 'Create a household instead'}
        </Link>
      </div>
    </CenteredPage>
  )
}
