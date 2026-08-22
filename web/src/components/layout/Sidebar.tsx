import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Monitor,
  AlertTriangle,
  Settings,
  Bell,
  ChevronLeft,
  LogOut,
} from 'lucide-react'
import { useState } from 'react'
import logo from '@/assets/logo.png'
import { useProfile } from '@/hooks/useProfile'
import { useOverviewStats } from '@/hooks/useOverviewStats'

const navItems = [
  { to: '/overview',      label: 'Overview',      icon: LayoutDashboard },
  { to: '/monitors',      label: 'Monitors',      icon: Monitor },
  { to: '/incidents',     label: 'Incidents',     icon: AlertTriangle },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/settings',      label: 'Settings',      icon: Settings },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()

  const { data: profile } = useProfile()
  const { data: stats } = useOverviewStats()

  const displayName = profile?.name ?? '…'
  const displayEmail = profile?.email ?? ''
  const initial = displayName.charAt(0).toUpperCase()
  const uptimePct = stats ? `${stats.uptime_percentage.toFixed(2)}%` : '—'
  const allUp = stats ? stats.incident_count === 0 : true

  function handleLogout() {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <aside style={{
      width: collapsed ? 52 : 200,
      minWidth: collapsed ? 52 : 200,
      background: '#161616',
      borderRight: '1px solid #222',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.15s ease, min-width 0.15s ease',
      overflow: 'hidden',
    }}>

      {/* Logo bar */}
      <div style={{
        height: collapsed ? 48 : 140,
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        padding: collapsed ? '0 14px' : '0 14px 0 16px',
        borderBottom: '1px solid #222',
        flexShrink: 0,
        transition: 'height 0.15s ease',
      }}>
        {!collapsed && (
          <img src={logo} alt="Genki" style={{ height: 120 }} />
        )}
        <button
          onClick={() => setCollapsed(o => !o)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#555', padding: 4, borderRadius: 4,
            display: 'flex', alignItems: 'center', flexShrink: 0,
          }}
        >
          <ChevronLeft
            size={14}
            style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
          />
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: collapsed ? '7px 0' : '6px 10px',
              borderRadius: 5,
              marginBottom: 1,
              fontSize: 13,
              fontWeight: isActive ? 500 : 400,
              color: isActive ? '#e8e8e8' : '#777',
              background: isActive ? '#252525' : 'transparent',
              textDecoration: 'none',
              justifyContent: collapsed ? 'center' : 'flex-start',
              transition: 'background 0.1s, color 0.1s',
            })}
          >
            <Icon size={15} strokeWidth={1.8} style={{ flexShrink: 0 }} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div style={{ borderTop: '1px solid #222', padding: '12px 14px', flexShrink: 0 }}>
          {/* System status */}
          <div style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>All Systems</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: allUp ? '#48bb78' : '#e53e3e',
            }} />
            <span style={{ fontSize: 12, color: '#888' }}>
              {allUp ? 'Operational' : 'Incidents active'}
            </span>
          </div>
          <div style={{ fontSize: 11, color: allUp ? '#48bb78' : '#e53e3e', marginBottom: 10 }}>
            {uptimePct} uptime
          </div>

          {/* User card */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 8px', background: '#1e1e1e', borderRadius: 6,
          }}>
            {/* Avatar */}
            <div style={{
              width: 26, height: 26, borderRadius: 6, background: '#e53e3e',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>
              {initial}
            </div>

            {/* Name + email */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: '#e8e8e8', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayName}
              </div>
              <div style={{ fontSize: 11, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayEmail}
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              title="Sign out"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#555', padding: 2, borderRadius: 4, flexShrink: 0,
                display: 'flex', alignItems: 'center',
                transition: 'color 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#e53e3e')}
              onMouseLeave={e => (e.currentTarget.style.color = '#555')}
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}
