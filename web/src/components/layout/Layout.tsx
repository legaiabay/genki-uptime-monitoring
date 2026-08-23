import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useSiteTitle } from '@/hooks/useSiteTitle'

export default function Layout() {
  useSiteTitle()

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--color-bg)' }}>
      <Sidebar />
      <main style={{ flex: 1, overflowY: 'auto', background: 'var(--color-bg)' }}>
        <Outlet />
      </main>
    </div>
  )
}
