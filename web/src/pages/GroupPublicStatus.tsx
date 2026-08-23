import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Activity, RefreshCw, Layers, ChevronLeft } from 'lucide-react'
import { useGroupPublicStatus } from '@/hooks/usePublicStatus'
import { StatusBanner, MonitorCard } from '@/pages/PublicStatus'

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function GroupPublicStatus() {
  const { groupSlug = '' } = useParams<{ groupSlug: string }>()
  const navigate = useNavigate()

  const { data, isLoading, isFetching, refetch, dataUpdatedAt, isError } = useGroupPublicStatus(groupSlug)

  const monitors = data?.monitors ?? []
  const overallUptime = data?.overall_uptime ?? 0
  const siteName = data?.site_name ?? 'Status'
  const groupName = data?.group_name ?? groupSlug

  useEffect(() => {
    document.title = groupName
      ? `${groupName} — ${siteName} Status`
      : `${siteName} — Status`
  }, [groupName, siteName])

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d', color: '#e8e8e8' }}>
      {/* Top bar */}
      <div style={{ borderBottom: '1px solid #1e1e1e', padding: '14px 0' }}>
        <div className="gps-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <button
              onClick={() => navigate('/status')}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                background: 'none', border: 'none', color: '#555',
                fontSize: 12, cursor: 'pointer', padding: 0,
              }}
            >
              <ChevronLeft size={14} />
              <span className="gps-site-name">{siteName}</span>
            </button>
            <span style={{ color: '#333', fontSize: 12, flexShrink: 0 }}>/</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <Layers size={13} color="#555" style={{ flexShrink: 0 }} />
              <span style={{
                fontSize: 15, fontWeight: 600, color: '#e8e8e8', letterSpacing: '-0.01em',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {groupName}
              </span>
            </div>
          </div>

          {/* Right side: updated + refresh */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555', flexShrink: 0 }}>
            {dataUpdatedAt > 0 && (
              <span className="gps-updated-text">
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

      <div className="gps-container gps-page-content">

        {/* Error / not found */}
        {isError && !isLoading && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#555' }}>
            <Activity size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
            <div style={{ fontSize: 14, marginBottom: 12 }}>Group not found or has no public monitors</div>
            <button
              onClick={() => navigate('/status')}
              style={{
                background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6,
                color: '#888', fontSize: 12, padding: '6px 14px', cursor: 'pointer',
              }}
            >
              Back to status page
            </button>
          </div>
        )}

        {!isError && (
          <>
            <StatusBanner monitors={monitors} overallUptime={overallUptime} />

            {/* Empty state */}
            {monitors.length === 0 && !isLoading && (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#555' }}>
                <Activity size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
                <div style={{ fontSize: 14 }}>No public monitors in this group</div>
              </div>
            )}

            {/* Stats row */}
            {monitors.length > 0 && (
              <div className="gps-stats-row">
                {[
                  { label: 'Total',    value: monitors.length,                                          color: '#888' },
                  { label: 'Up',       value: monitors.filter(m => m.status === 'up').length,       color: '#48bb78' },
                  { label: 'Down',     value: monitors.filter(m => m.status === 'down').length,     color: '#e53e3e' },
                  { label: 'Degraded', value: monitors.filter(m => m.status === 'degraded').length, color: '#ed8936' },
                ].map(s => (
                  <div key={s.label} style={{
                    background: '#161616', border: '1px solid #1e1e1e',
                    borderRadius: 8, padding: '12px 20px',
                    display: 'flex', flexDirection: 'column', gap: 2, flex: 1,
                  }}>
                    <span style={{ fontSize: 11, color: '#555' }}>{s.label}</span>
                    <span style={{ fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Monitor grid */}
            <div className="gps-monitor-grid">
              {monitors.map(mon => <MonitorCard key={mon.id} mon={mon} />)}
            </div>
          </>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 48, fontSize: 11, color: '#333' }}>
          Powered by Genki Uptime Monitoring
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        *, *::before, *::after { box-sizing: border-box; }

        .gps-container {
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 24px;
        }
        .gps-page-content {
          padding-top: 36px;
          padding-bottom: 40px;
        }

        /* Stats row — spread across full width */
        .gps-stats-row {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }

        /* Monitor grid — 2 cols on desktop, 1 col on mobile */
        .gps-monitor-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }

        .gps-monitor-grid > * {
          min-width: 0;
        }

        /* "Updated X ago" hidden on small screens */
        .gps-updated-text {
          display: inline;
        }

        @media (max-width: 640px) {
          .gps-container {
            padding: 0 16px;
          }
          .gps-page-content {
            padding-top: 24px;
            padding-bottom: 28px;
          }
          .gps-monitor-grid {
            grid-template-columns: 1fr;
          }
          .gps-stats-row {
            gap: 8px;
          }
          .gps-stats-row > div {
            padding: 10px 14px;
            flex: 1 1 calc(50% - 4px);
            min-width: 0;
          }
          .gps-updated-text {
            display: none;
          }
          .gps-site-name {
            display: none;
          }
        }
      `}</style>
    </div>
  )
}
