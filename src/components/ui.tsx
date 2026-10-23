import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { XIcon } from './icons'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:brightness-105 active:brightness-95',
  secondary: 'bg-surface-2 text-fg hover:brightness-[0.97] dark:hover:brightness-110',
  ghost: 'text-fg hover:bg-surface-2',
  danger: 'bg-danger text-white hover:brightness-105 active:brightness-95',
}

export function Button({
  variant = 'secondary',
  busy,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || busy}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {busy && <Spinner size={16} />}
      {children}
    </button>
  )
}

export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className="inline-block animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
      style={{ width: size, height: size }}
    />
  )
}

export function Splash({ label }: { label?: string }) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 text-muted">
      <img src="/favicon.svg" alt="" width={56} height={56} className="rounded-2xl" />
      <Spinner />
      {label && <p className="text-sm">{label}</p>}
    </div>
  )
}

/** Centered single-column layout for sign-in and onboarding screens. */
export function CenteredPage({ children }: { children: ReactNode }) {
  return (
    <div className="pt-safe pb-safe flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}

export function InlineConfirm({
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  busy,
}: {
  message: ReactNode
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
}) {
  return (
    <div role="alertdialog" className="rounded-2xl border border-danger/30 bg-danger-soft p-4">
      <p className="text-[15px]">{message}</p>
      <div className="mt-3 flex gap-2">
        <Button variant="danger" onClick={onConfirm} busy={busy} className="flex-1">
          {confirmLabel}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy} className="flex-1">
          Cancel
        </Button>
      </div>
    </div>
  )
}

export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="animate-fade absolute inset-0 bg-black/45" onClick={onClose} />
      <div
        ref={panelRef}
        className="animate-sheet pb-safe relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-surface shadow-2xl md:rounded-3xl"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-line px-5 py-3">
          <h2 className="flex-1 text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 grid size-11 place-items-center rounded-full text-muted hover:bg-surface-2">
            <XIcon />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 w-full items-center justify-between gap-3 text-[15px]"
    >
      <span>{label}</span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-accent' : 'bg-surface-2 ring-1 ring-line'}`}>
        <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </button>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-9 rounded-lg px-3 text-sm font-semibold transition ${value === o.value ? 'bg-surface text-fg shadow-sm' : 'text-muted'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </label>
  )
}
