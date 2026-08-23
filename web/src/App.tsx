import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import Layout from '@/components/layout/Layout'
import Overview from '@/pages/Overview'
import Monitors from '@/pages/Monitors'
import Incidents from '@/pages/Incidents'
import Settings from '@/pages/Settings'
import Notifications from '@/pages/Notifications'
import Login from '@/pages/Login'
import Setup from '@/pages/Setup'
import ForgotPassword from '@/pages/ForgotPassword'
import PublicStatus from '@/pages/PublicStatus'
import GroupPublicStatus from '@/pages/GroupPublicStatus'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: 1,
    },
  },
})

// Checks /api/v1/auth/needs-setup and redirects to /setup when no users exist.
// Redirects away from /setup once an account exists.
function SetupGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    fetch('/api/v1/auth/needs-setup')
      .then((r) => r.json())
      .then((data: { needs_setup: boolean }) => {
        if (data.needs_setup && location.pathname !== '/setup') {
          navigate('/setup', { replace: true })
        } else if (!data.needs_setup && location.pathname === '/setup') {
          navigate('/login', { replace: true })
        }
      })
      .catch(() => {
        // If the check fails, let the app proceed normally
      })
      .finally(() => setChecking(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (checking) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0d0d0d',
      }}>
        <div style={{ width: 24, height: 24, border: '2px solid #e53e3e', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      </div>
    )
  }

  return <>{children}</>
}

function AppRoutes() {
  return (
    <SetupGuard>
      <Routes>
        <Route path="/login"           element={<Login />} />
        <Route path="/setup"           element={<Setup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/status" element={<PublicStatus />} />
        <Route path="/status/group/:groupSlug" element={<GroupPublicStatus />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/overview" replace />} />
          <Route path="overview"      element={<Overview />} />
          <Route path="monitors"      element={<Monitors />} />
          <Route path="incidents"     element={<Incidents />} />
          <Route path="settings"      element={<Settings />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>
      </Routes>
    </SetupGuard>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
