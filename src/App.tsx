import { useState } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router'
import { isConfigured } from './lib/supabase'
import { takeReturnTo } from './lib/returnTo'
import { AuthProvider, useAuth } from './state/auth'
import { HouseholdProvider, useHousehold } from './state/household'
import { DataProvider } from './state/data'
import { ToastProvider } from './components/toast'
import { Button, CenteredPage, Splash } from './components/ui'
import AppShell from './components/AppShell'
import SignInPage from './pages/SignInPage'
import NamePage from './pages/NamePage'
import CreateHouseholdPage from './pages/CreateHouseholdPage'
import JoinPage from './pages/JoinPage'
import ListsPage from './pages/ListsPage'
import CalendarPage from './pages/CalendarPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  if (!isConfigured) return <MissingConfig />
  return (
    <ToastProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ToastProvider>
  )
}

function Gate() {
  const { ready, session, profile, profileReady, profileError, reloadProfile } = useAuth()
  if (!ready) return <Splash />
  if (!session) return <SignInPage />
  if (profileError) return <ErrorScreen message={profileError} onRetry={reloadProfile} />
  if (!profileReady) return <Splash />
  if (!profile?.display_name) return <NamePage />

  return (
    <HouseholdProvider>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/join/:token" element={<JoinPage />} />
        <Route element={<HouseholdGate />}>
          <Route element={<AppShell />}>
            <Route path="/lists/:listId?" element={<ListsPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/lists" replace />} />
      </Routes>
    </HouseholdProvider>
  )
}

/** Sends "/" to the page the user started on before signing in (if any), else Lists. */
function RootRedirect() {
  const [to] = useState(() => takeReturnTo() ?? '/lists')
  return <Navigate to={to === '/' ? '/lists' : to} replace />
}

function HouseholdGate() {
  const { userId } = useAuth()
  const { ready, error, active, reload } = useHousehold()
  if (!ready) return <Splash />
  if (!active) {
    if (error) return <ErrorScreen message={error} onRetry={() => void reload()} />
    return <CreateHouseholdPage />
  }
  return (
    <DataProvider key={active.household_id} membership={active} userId={userId!}>
      <Outlet />
    </DataProvider>
  )
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <CenteredPage>
      <div className="text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-muted">{message}</p>
        <Button variant="primary" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </CenteredPage>
  )
}

function MissingConfig() {
  return (
    <CenteredPage>
      <h1 className="text-xl font-semibold">Supabase isn't configured</h1>
      <p className="mt-2 text-muted">
        Set <code className="font-mono text-fg">VITE_SUPABASE_URL</code> and <code className="font-mono text-fg">VITE_SUPABASE_ANON_KEY</code>{' '}
        (see <code className="font-mono text-fg">.env.example</code> and the README), then rebuild.
      </p>
    </CenteredPage>
  )
}
