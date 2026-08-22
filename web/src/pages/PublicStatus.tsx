import { Activity, RefreshCw } from 'lucide-react'
import { usePublicStatus, type PublicLog } from '@/hooks/usePublicStatus'
import logo from '@/assets/logo.png'

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const statusColor: Record<string, string> = {
  up:       '#48bb78',
  down:     '#e53e3e',
  degraded: '#ed8936',
  pending:  '#555',
}

const statusLabel: Record<string, string> = {
  up:       'Operational',
  down:     'Outage',
  degraded: 'Degraded',
  pending:  'Pending',
}

function MiniBar({ logs }: { logs: PublicLog[] }) {
  const bars = [...logs].reverse().slice(-60)
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
      {bars.map((log, i) => (
        <div key={i} style={{
          width: 6,
          height: 24,
          borderRadius: 2,
          background: statusColor[log.status] ?? '#444',
          opacity: 0.85,
          flexShrink: 0,
        }} />
      ))}
      {bars.length === 0 && (
        <span style={{ fontSize: 11, color: '#444' }}>No data</span>
      )}
    </div>
  )
}

export default function PublicStatus() {
  const { data, isLoading, refetch, dataUpdatedAt } = usePublicStatus()

  const monitors = data?.monitors ?? []
  const overallUptime = data?.overall_uptime ?? 0
  const allUp = monitors.length > 0 && monitors.every(m => m.status === 'up')
  const hasDown = monitors.some(m => m.status === 'down')

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d', color: '#e8e8e8' }}>
      {/* Top bar */}
      <div style={{ borderBottom: '1px solid #1e1e1e', padding: '16px 0' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={logo} alt="Logo" style={{ height: 28 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555' }}>
            {dataUpdatedAt > 0 && `Updated ${timeAgo(new Date(dataUpdatedAt).toISOString())}`}
            <button
              onClick={() => refetch()}
              style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: 4 }}
            >
              <RefreshCw size={13} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>

        {/* Overall status banner */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '20px 24px', borderRadius: 10, marginBottom: 36,
          background: hasDown ? 'rgba(229,62,62,0.08)' : allUp ? 'rgba(72,187,120,0.08)' : 'rgba(237,137,54,0.08)',
          border: `1px solid ${hasDown ? 'rgba(229,62,62,0.2)' : allUp ? 'rgba(72,187,120,0.2)' : 'rgba(237,137,54,0.2)'}`,
        }}>
          <div style={{
            width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
            background: hasDown ? '#e53e3e' : allUp ? '#48bb78' : '#ed8936',
            boxShadow: `0 0 8px ${hasDown ? '#e53e3e' : allUp ? '#48bb78' : '#ed8936'}`,
          }} />
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#e8e8e8' }}>
              {hasDown ? 'Some systems are experiencing issues'
                : allUp  ? 'All systems operational'
                : monitors.length === 0 ? 'No public monitors configured'
                : 'Some systems degraded'}
            </div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 3 }}>
              Overall uptime: {overallUptime.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Monitor list */}
        {monitors.length === 0 && !isLoading && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#555' }}>
            <Activity size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
            <div style={{ fontSize: 14 }}>No public monitors available</div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {monitors.map((mon, idx) => {
            const isFirst = idx === 0
            const isLast = idx === monitors.length - 1
            const color = statusColor[mon.status] ?? '#555'
            return (
              <div key={mon.id} style={{
                background: '#161616',
                border: '1px solid #1e1e1e',
                borderRadius: isFirst && isLast ? 8 : isFirst ? '8px 8px 0 0' : isLast ? '0 0 8px 8px' : 0,
                borderTopWidth: idx > 0 ? 0 : 1,
                padding: '16px 20px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#e8e8e8' }}>{mon.name}</div>
                    <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{mon.url}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 500,
                      color: color, background: `${color}18`,
                      padding: '2px 8px', borderRadius: 4,
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                      {statusLabel[mon.status] ?? mon.status}
                    </span>
                    {mon.last_checked_at && (
                      <span style={{ fontSize: 11, color: '#444' }}>{timeAgo(mon.last_checked_at)}</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <MiniBar logs={mon.logs} />
                  <span style={{ fontSize: 11, color: '#555' }}>
                    {mon.uptime_percentage.toFixed(2)}% uptime
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ fontSize: 10, color: '#333' }}>90 days ago</span>
                  <span style={{ fontSize: 10, color: '#333' }}>Today</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 48, fontSize: 11, color: '#333' }}>
          Powered by Genki Uptime Monitoring
        </div>
      </div>
    </div>
  )
}
