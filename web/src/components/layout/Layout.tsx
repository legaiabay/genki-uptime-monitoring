import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useSiteTitle } from '@/hooks/useSiteTitle'

export default function Layout() {
  useSiteTitle()

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#111' }}>
      <Sidebar />
      <main style={{ flex: 1, overflowY: 'auto', background: '#111' }}>
        <Outlet />
      </main>
    </div>
  )
}
