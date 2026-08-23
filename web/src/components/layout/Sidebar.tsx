import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Monitor,
  AlertTriangle,
  Settings,
  Bell,
  ChevronLeft,
  LogOut,
  Sun,
  Moon,
} from 'lucide-react'
import { useState } from 'react'
import logo from '@/assets/logo.png'
import logoDark from '@/assets/logo-dark.png'
import { useProfile } from '@/hooks/useProfile'
import { useOverviewStats } from '@/hooks/useOverviewStats'
import UserAvatar from '@/components/ui/UserAvatar'
import { useThemeStore } from '@/store/themeStore'

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
  const { theme, toggleTheme } = useThemeStore()

  const displayName = profile?.name ?? '…'
  const displayEmail = profile?.email ?? ''
  const uptimePct = stats ? `${stats.uptime_percentage.toFixed(2)}%` : '—'
  const allUp = stats ? stats.incident_count === 0 : true
  const isLight = theme === 'light'

  function handleLogout() {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <aside style={{
      width: collapsed ? 52 : 200,
      minWidth: collapsed ? 52 : 200,
      background: 'var(--color-sidebar-bg)',
      borderRight: '1px solid var(--color-border)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.15s ease, min-width 0.15s ease, background 0.2s ease, border-color 0.2s ease',
      overflow: 'hidden',
    }}>

      {/* Logo bar */}
      <div style={{
        height: collapsed ? 48 : 140,
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        padding: collapsed ? '0 14px' : '0 14px 0 16px',
        borderBottom: '1px solid var(--color-border)',
        flexShrink: 0,
        transition: 'height 0.15s ease',
      }}>
        {!collapsed && (
          <img src={isLight ? logoDark : logo} alt="Genki" style={{ height: 120 }} />
        )}
        <button
          onClick={() => setCollapsed(o => !o)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-text-dim)', padding: 4, borderRadius: 4,
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
              color: isActive ? 'var(--color-text)' : 'var(--color-text-muted)',
              background: isActive ? 'var(--color-surface-hover)' : 'transparent',
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
      <div style={{ borderTop: '1px solid var(--color-border)', padding: collapsed ? '10px 6px' : '12px 14px', flexShrink: 0 }}>

        {/* Theme toggle */}
        <div style={{
          display: 'flex',
          justifyContent: collapsed ? 'center' : 'flex-start',
          marginBottom: collapsed ? 0 : 10,
        }}>
          <button
            onClick={toggleTheme}
            title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              padding: collapsed ? '5px 6px' : '4px 8px',
              fontSize: 11,
              transition: 'background 0.15s, color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--color-surface-hover)'
              e.currentTarget.style.color = 'var(--color-text)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'var(--color-surface-2)'
              e.currentTarget.style.color = 'var(--color-text-muted)'
            }}
          >
            {isLight
              ? <Moon size={12} strokeWidth={1.8} />
              : <Sun size={12} strokeWidth={1.8} />
            }
            {!collapsed && (
              <span>{isLight ? 'Dark' : 'Light'}</span>
            )}
          </button>
        </div>

        {/* System status + user card — only when expanded */}
        {!collapsed && (
          <>
            {/* System status */}
            <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginBottom: 4 }}>All Systems</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: allUp ? 'var(--color-up)' : 'var(--color-down)',
              }} />
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                {allUp ? 'Operational' : 'Incidents active'}
              </span>
            </div>
            <div style={{ fontSize: 11, color: allUp ? 'var(--color-up)' : 'var(--color-down)', marginBottom: 10 }}>
              {uptimePct} uptime
            </div>

            {/* User card */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 8px', background: 'var(--color-user-card-bg)', borderRadius: 6,
            }}>
              <UserAvatar name={displayName} size={26} borderRadius={6} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayName}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayEmail}
                </div>
              </div>

              <button
                onClick={handleLogout}
                title="Sign out"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--color-text-dim)', padding: 2, borderRadius: 4, flexShrink: 0,
                  display: 'flex', alignItems: 'center',
                  transition: 'color 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-down)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-dim)')}
              >
                <LogOut size={13} />
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
