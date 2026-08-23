import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, RefreshCw, Layers, Tag, ChevronRight } from 'lucide-react'
import { usePublicStatus, type PublicLog, type PublicMonitor } from '@/hooks/usePublicStatus'

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export const statusColor: Record<string, string> = {
  up:       '#48bb78',
  down:     '#e53e3e',
  degraded: '#ed8936',
  pending:  '#555',
}

export const statusLabel: Record<string, string> = {
  up:       'Operational',
  down:     'Outage',
  degraded: 'Degraded',
  pending:  'Pending',
}

const LABEL_COLORS = [
  '#4299e1', '#48bb78', '#ed8936', '#9f7aea',
  '#f6ad55', '#fc8181', '#68d391', '#76e4f7',
]

export function labelColor(label: string) {
  let hash = 0
  for (let i = 0; i < label.length; i++) hash = label.charCodeAt(i) + ((hash << 5) - hash)
  return LABEL_COLORS[Math.abs(hash) % LABEL_COLORS.length]
}

export function groupSlugify(name: string) {
  return name.toLowerCase().replace(/\s+/g, '-')
}

export function MiniBar({ logs }: { logs: PublicLog[] }) {
  const bars = [...logs].reverse().slice(-45)
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', overflow: 'hidden', width: '100%' }}>
      {bars.map((log, i) => (
        <div key={i} style={{
          width: 5, height: 20, borderRadius: 2,
          background: statusColor[log.status] ?? '#444',
          opacity: 0.85, flexShrink: 0,
        }} />
      ))}
      {bars.length === 0 && <span style={{ fontSize: 11, color: '#444' }}>No data</span>}
    </div>
  )
}

export function MonitorCard({ mon, showURL = true }: { mon: PublicMonitor; showURL?: boolean }) {
  const color = statusColor[mon.status] ?? '#555'
  return (
    <div style={{
      background: '#161616', border: '1px solid #1e1e1e',
      borderRadius: 8, padding: '16px 18px',
    }}>
      {/* Name + status badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 14, fontWeight: 500, color: '#e8e8e8',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {mon.name}
          </div>
          <div style={{
            fontSize: 11, color: '#555', marginTop: 2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {showURL ? mon.url : ''}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <span style={{
            fontSize: 11, fontWeight: 500, color, background: `${color}18`,
            padding: '2px 8px', borderRadius: 4,
            display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
            {statusLabel[mon.status] ?? mon.status}
          </span>
          {mon.last_checked_at && (
            <span style={{ fontSize: 10, color: '#444' }}>{timeAgo(mon.last_checked_at)}</span>
          )}
        </div>
      </div>

      {/* Labels */}
      {mon.labels && mon.labels.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
          {mon.labels.map(l => {
            const c = labelColor(l)
            return (
              <span key={l} style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 10, fontWeight: 500,
                padding: '1px 7px', borderRadius: 8,
                background: `${c}18`, color: c, border: `1px solid ${c}40`,
                whiteSpace: 'nowrap',
              }}>
                <Tag size={8} />{l}
              </span>
            )
          })}
        </div>
      )}

      {/* Mini bar + uptime */}
      <div style={{ overflow: 'hidden' }}>
        <div className="ps-minibar-wrap">
          <MiniBar logs={mon.logs} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: 10, color: '#333' }}>90d ago</span>
          <span style={{ fontSize: 10, color: '#333' }}>Today</span>
        </div>
        <div style={{ marginTop: 4, fontSize: 11, color: '#555', textAlign: 'right' }}>
          {mon.uptime_percentage.toFixed(2)}% uptime
        </div>
      </div>
    </div>
  )
}

// ── Status banner ─────────────────────────────────────────────────────────────

export function StatusBanner({
  monitors,
  overallUptime,
}: {
  monitors: PublicMonitor[]
  overallUptime: number
}) {
  const allUp = monitors.length > 0 && monitors.every(m => m.status === 'up')
  const hasDown = monitors.some(m => m.status === 'down')

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '18px 20px', borderRadius: 10, marginBottom: 28,
      background: hasDown ? 'rgba(229,62,62,0.08)' : allUp ? 'rgba(72,187,120,0.08)' : 'rgba(237,137,54,0.08)',
      border: `1px solid ${hasDown ? 'rgba(229,62,62,0.2)' : allUp ? 'rgba(72,187,120,0.2)' : 'rgba(237,137,54,0.2)'}`,
    }}>
      <div style={{
        width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
        background: hasDown ? '#e53e3e' : allUp ? '#48bb78' : '#ed8936',
        boxShadow: `0 0 8px ${hasDown ? '#e53e3e' : allUp ? '#48bb78' : '#ed8936'}`,
      }} />
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#e8e8e8', lineHeight: 1.3 }}>
          {monitors.length === 0 ? 'No public monitors configured'
            : hasDown ? 'Some systems are experiencing issues'
            : allUp   ? 'All systems operational'
            : 'Some systems degraded'}
        </div>
        <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
          Overall uptime: {overallUptime.toFixed(2)}%
        </div>
      </div>
    </div>
  )
}

// ── Group section ─────────────────────────────────────────────────────────────

function GroupSection({
  groupName,
  monitors,
  showLink,
  showURL = true,
}: {
  groupName: string
  monitors: PublicMonitor[]
  showLink: boolean
  showURL?: boolean
}) {
  const navigate = useNavigate()
  const hasDown = monitors.some(m => m.status === 'down')
  const allUp = monitors.every(m => m.status === 'up')
  const statusDot = hasDown ? '#e53e3e' : allUp ? '#48bb78' : '#ed8936'

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10, gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Layers size={14} color="#555" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: '#e8e8e8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{groupName}</span>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', background: statusDot,
            display: 'inline-block', flexShrink: 0,
          }} />
          <span style={{ fontSize: 12, color: '#555', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {monitors.filter(m => m.status === 'up').length}/{monitors.length} up
          </span>
        </div>
        {showLink && (
          <button
            onClick={() => navigate(`/status/group/${groupSlugify(groupName)}`)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
              background: 'none', border: '1px solid #2a2a2a', borderRadius: 5,
              color: '#666', fontSize: 11, padding: '4px 10px', cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            View <ChevronRight size={11} />
          </button>
        )}
      </div>
      <div className="ps-monitor-grid">
        {monitors.map(mon => <MonitorCard key={mon.id} mon={mon} showURL={showURL} />)}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PublicStatus() {
  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = usePublicStatus()

  const monitors = data?.monitors ?? []
  const overallUptime = data?.overall_uptime ?? 0
  const siteName = data?.site_name ?? 'Status'
  const showURL = data?.show_url ?? true
  const groups = data?.groups ?? []

  useEffect(() => {
    document.title = siteName ? `${siteName} — Status` : 'Status'
  }, [siteName])

  const grouped: Record<string, PublicMonitor[]> = {}
  const ungrouped: PublicMonitor[] = []
  for (const m of monitors) {
    if (m.group_name) {
      if (!grouped[m.group_name]) grouped[m.group_name] = []
      grouped[m.group_name].push(m)
    } else {
      ungrouped.push(m)
    }
  }

  const hasGroups = groups.length > 0

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d', color: '#e8e8e8' }}>
      {/* Top bar */}
      <div style={{ borderBottom: '1px solid #1e1e1e', padding: '14px 0' }}>
        <div className="ps-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#e8e8e8', letterSpacing: '-0.01em' }}>
            {siteName}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555' }}>
            {dataUpdatedAt > 0 && (
              <span style={{ display: 'none' }} className="ps-updated">
                Updated {timeAgo(new Date(dataUpdatedAt).toISOString())}
              </span>
            )}
            {dataUpdatedAt > 0 && (
              <span className="ps-updated-text">
                Updated {timeAgo(new Date(dataUpdatedAt).toISOString())}
              </span>
            )}
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              style={{
                background: 'none', border: 'none',
                color: isFetching ? '#888' : '#555',
                cursor: isFetching ? 'not-allowed' : 'pointer',
                padding: 4, display: 'flex', alignItems: 'center',
              }}
            >
              <RefreshCw size={13} style={{ animation: isFetching ? 'spin 0.8s linear infinite' : 'none' }} />
            </button>
          </div>
        </div>
      </div>

      <div className="ps-container ps-page-content">
        <StatusBanner monitors={monitors} overallUptime={overallUptime} />

        {/* Group nav pills */}
        {hasGroups && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
            {groups.map(g => {
              const gMonitors = grouped[g] ?? []
              const gDown = gMonitors.some(m => m.status === 'down')
              const gUp = gMonitors.length > 0 && gMonitors.every(m => m.status === 'up')
              const dot = gDown ? '#e53e3e' : gUp ? '#48bb78' : '#ed8936'
              return (
                <a
                  key={g}
                  href={`/status/group/${groupSlugify(g)}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 14px', borderRadius: 6,
                    background: '#161616', border: '1px solid #2a2a2a',
                    color: '#aaa', fontSize: 12, textDecoration: 'none',
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                  <Layers size={11} color="#555" />
                  {g}
                </a>
              )
            })}
          </div>
        )}

        {/* Empty state */}
        {monitors.length === 0 && !isLoading && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#555' }}>
            <Activity size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
            <div style={{ fontSize: 14 }}>No public monitors available</div>
          </div>
        )}

        {/* Grouped sections */}
        {Object.entries(grouped).map(([group, items]) => (
          <GroupSection key={group} groupName={group} monitors={items} showLink={true} showURL={showURL} />
        ))}

        {/* Ungrouped */}
        {ungrouped.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            {hasGroups && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#888' }}>Other</span>
                <span style={{ fontSize: 12, color: '#555' }}>{ungrouped.length} monitor{ungrouped.length !== 1 ? 's' : ''}</span>
              </div>
            )}
            <div className="ps-monitor-grid">
              {ungrouped.map(mon => <MonitorCard key={mon.id} mon={mon} showURL={showURL} />)}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 48, fontSize: 11, color: '#333' }}>
          Powered by Genki Uptime Monitoring
        </div>
      </div>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        /* Layout */
        .ps-container {
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 24px;
        }
        .ps-page-content {
          padding-top: 36px;
          padding-bottom: 40px;
        }

        /* Monitor grid — 2 cols on desktop, 1 col on mobile */
        .ps-monitor-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }

        /* Prevent grid children from overflowing their cell */
        .ps-monitor-grid > * {
          min-width: 0;
        }

        /* MiniBar container must not overflow the card */
        .ps-minibar-wrap {
          min-width: 0;
          overflow: hidden;
          width: 100%;
        }

        /* "Updated X ago" — hide on very small screens */
        .ps-updated-text {
          display: inline;
        }

        @media (max-width: 640px) {
          .ps-container {
            padding: 0 16px;
          }
          .ps-page-content {
            padding-top: 24px;
            padding-bottom: 28px;
          }
          .ps-monitor-grid {
            grid-template-columns: 1fr;
          }
          .ps-updated-text {
            display: none;
          }
        }
      `}</style>
    </div>
  )
}
