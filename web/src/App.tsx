import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/components/layout/Layout'
import Overview from '@/pages/Overview'
import Monitors from '@/pages/Monitors'
import Incidents from '@/pages/Incidents'
import Settings from '@/pages/Settings'
import Notifications from '@/pages/Notifications'
import Login from '@/pages/Login'
import PublicStatus from '@/pages/PublicStatus'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login"  element={<Login />} />
          <Route path="/status" element={<PublicStatus />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/overview" replace />} />
            <Route path="overview"      element={<Overview />} />
            <Route path="monitors"      element={<Monitors />} />
            <Route path="incidents"     element={<Incidents />} />
            <Route path="settings"      element={<Settings />} />
            <Route path="notifications" element={<Notifications />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
