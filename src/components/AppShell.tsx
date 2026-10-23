import type { ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useHousehold } from '../state/household'
import { CalendarIcon, ChevronLeftIcon, GearIcon, ListIcon } from './icons'

export default function AppShell() {
  const { active } = useHousehold()
  const { pathname } = useLocation()
  const inSettings = pathname.startsWith('/settings')

  return (
    <div className="mx-auto flex h-dvh max-w-2xl flex-col bg-bg md:border-x md:border-line">
      <header className="pt-safe shrink-0 border-b border-line bg-bg">
        <div className="flex h-14 items-center gap-1 px-2">
          {inSettings ? (
            <>
              <Link to="/lists" aria-label="Back" className="grid size-11 place-items-center rounded-full hover:bg-surface-2">
                <ChevronLeftIcon />
              </Link>
              <h1 className="text-lg font-semibold">Settings</h1>
            </>
          ) : (
            <>
              <h1 className="min-w-0 flex-1 truncate px-2 text-lg font-bold tracking-tight">{active?.household.name}</h1>
              <Link to="/settings" aria-label="Household settings" className="grid size-11 place-items-center rounded-full text-muted hover:bg-surface-2">
                <GearIcon />
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="min-h-0 flex-1">
        <Outlet />
      </main>

      <nav className="tabbar pb-safe shrink-0 border-t border-line bg-surface" aria-label="Main">
        <div className="grid grid-cols-2">
          <Tab to="/lists" label="Lists" icon={<ListIcon size={24} />} />
          <Tab to="/calendar" label="Calendar" icon={<CalendarIcon size={24} />} />
        </div>
      </nav>
    </div>
  )
}

function Tab({ to, label, icon }: { to: string; label: string; icon: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold transition ${isActive ? 'text-accent' : 'text-muted hover:text-fg'}`
      }
    >
      {icon}
      {label}
    </NavLink>
  )
}
