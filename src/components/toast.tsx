import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

type Kind = 'error' | 'info'
interface Toast {
  id: number
  message: string
  kind: Kind
}

const ToastContext = createContext<(message: string, kind?: Kind) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const show = useCallback((message: string, kind: Kind = 'error') => {
    const id = nextId.current++
    setToasts((t) => [...t.filter((x) => x.message !== message), { id, message, kind }].slice(-3))
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500)
  }, [])

  const value = useMemo(() => show, [show])
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pt-safe pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 px-4 pt-3" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-fade pointer-events-auto max-w-md rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
              t.kind === 'error' ? 'bg-danger text-white' : 'bg-fg text-bg'
            }`}
            onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
