import { useEffect, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router'
import { initialAuthError, supabase } from '../lib/supabase'
import { errorMessage } from '../lib/errors'
import { saveReturnTo } from '../lib/returnTo'
import { Button, CenteredPage } from '../components/ui'
import { MailIcon } from '../components/icons'

export default function SignInPage() {
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(initialAuthError)
  const [cooldown, setCooldown] = useState(0)
  const invited = location.pathname.startsWith('/join/')

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function sendLink(address: string) {
    setBusy(true)
    setError(null)
    const path = location.pathname + location.search
    saveReturnTo(path)
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: window.location.origin + path, shouldCreateUser: true },
    })
    setBusy(false)
    if (error) {
      setError(errorMessage(error))
      return
    }
    setSentTo(address)
    setCooldown(60)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const address = email.trim().toLowerCase()
    if (address) await sendLink(address)
  }

  async function onVerify(e: FormEvent) {
    e.preventDefault()
    if (!sentTo) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({ email: sentTo, token: code.trim(), type: 'email' })
    setBusy(false)
    if (error) setError(errorMessage(error))
  }

  return (
    <CenteredPage>
      <div className="mb-8 text-center">
        <img src="/favicon.svg" alt="" width={64} height={64} className="mx-auto mb-4 rounded-2xl shadow-sm" />
        <h1 className="text-2xl font-bold tracking-tight">Our Shared Lists</h1>
        <p className="mt-1 text-muted">
          {invited ? "You've been invited to a household. Sign in to join." : 'Lists and a calendar for your household.'}
        </p>
      </div>

      {sentTo ? (
        <div className="rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-line">
          <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
            <MailIcon size={24} />
          </div>
          <h2 className="text-center text-xl font-semibold">Check your email</h2>
          <p className="mt-2 text-center text-[15px] text-muted">
            We sent a sign-in link to <span className="font-medium text-fg">{sentTo}</span>. Open it on this device.
          </p>

          <form onSubmit={onVerify} className="mt-6 border-t border-line pt-5">
            <label className="mb-1.5 block text-sm font-medium text-muted" htmlFor="otp">
              Or type the code from the email
            </label>
            <div className="flex gap-2">
              <input
                id="otp"
                className="field tracking-widest"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={10}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              />
              <Button type="submit" variant="primary" busy={busy} disabled={code.length < 6}>
                Verify
              </Button>
            </div>
          </form>

          {error && <p className="mt-3 text-sm text-danger">{error}</p>}

          <div className="mt-5 flex justify-between text-sm">
            <button type="button" className="font-medium text-muted hover:text-fg" onClick={() => { setSentTo(null); setCode(''); setError(null) }}>
              Use a different email
            </button>
            <button
              type="button"
              className="font-medium text-accent disabled:text-muted"
              disabled={cooldown > 0 || busy}
              onClick={() => void sendLink(sentTo)}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend link'}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-line">
          <label className="mb-1.5 block text-sm font-medium text-muted" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            className="field"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
          <Button type="submit" variant="primary" busy={busy} disabled={!email.trim()} className="mt-4 w-full">
            Email me a sign-in link
          </Button>
          <p className="mt-3 text-center text-xs text-muted">No password needed. New here? This creates your account.</p>
        </form>
      )}
    </CenteredPage>
  )
}
