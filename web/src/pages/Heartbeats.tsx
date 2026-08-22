import { useState } from 'react'
import { Activity, Copy, RefreshCw, Check } from 'lucide-react'
import Card from '@/components/ui/Card'
import StatusBadge from '@/components/ui/StatusBadge'
import { useHeartbeats } from '@/hooks/useHeartbeats'
import { useMonitors } from '@/hooks/useMonitors'
import type { MonitorStatus } from '@/types'

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#48bb78' : '#555', padding: 2, display: 'flex', alignItems: 'center' }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  )
}

export default function Heartbeats() {
  const { data: heartbeats = [], isLoading, refetch } = useHeartbeats()
  const { data: monitors = [] } = useMonitors()

  // Group heartbeats by monitor
  const monitorIds = Array.from(new Set(heartbeats.map(h => h.monitor_id)))

  return (
    <div style={{ padding: '20px 24px' }}>
      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#e8e8e8', marginBottom: 2 }}>Heartbeats</h1>
          <p style={{ fontSize: 12, color: '#555' }}>Passive monitoring — your services ping us</p>
        </div>
        <button
          onClick={() => refetch()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, color: '#888', fontSize: 12, padding: '6px 10px', cursor: 'pointer' }}
        >
          <RefreshCw size={13} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </div>

      {/* how it works */}
      <Card style={{ padding: '16px 20px', marginBottom: 20, borderColor: '#2a2a2a' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(229,62,62,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Activity size={16} color="#e53e3e" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8e8', marginBottom: 4 }}>How Heartbeats Work</div>
            <div style={{ fontSize: 12, color: '#666', lineHeight: 1.6 }}>
              Configure your cron jobs or services to send a GET request to the heartbeat URL periodically.
              If we don't receive a ping within the expected interval, we'll create an incident.
            </div>
            <code style={{ display: 'inline-block', marginTop: 8, fontSize: 11, color: '#e8e8e8', background: '#161616', padding: '4px 10px', borderRadius: 4, border: '1px solid #2a2a2a' }}>
              GET /api/v1/heartbeats/:slug
            </code>
          </div>
        </div>
      </Card>

      {/* per-monitor heartbeat groups */}
      {monitorIds.length === 0 && (
        <Card style={{ padding: '48px', textAlign: 'center' }}>
          <Activity size={32} color="#333" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: 13, color: '#555' }}>No heartbeats received yet.</div>
          <div style={{ fontSize: 12, color: '#444', marginTop: 4 }}>Create a heartbeat monitor and start sending pings.</div>
        </Card>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {monitorIds.map(monId => {
          const mon = monitors.find(m => m.id === monId)
          const monHeartbeats = heartbeats.filter(h => h.monitor_id === monId)
          const latest = monHeartbeats[0]
          const slug = `monitor-${monId}`
          const pingUrl = `${window.location.origin}/api/v1/heartbeats/${slug}`

          return (
            <Card key={monId}>
              {/* monitor header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #222' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: latest?.status === 'up' ? '#48bb78' : '#e53e3e' }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8e8' }}>{mon?.name ?? `Monitor ${monId}`}</div>
                    <div style={{ fontSize: 11, color: '#555', marginTop: 1 }}>
                      Last ping: {latest ? timeAgo(latest.created_at) : 'Never'}
                      {latest?.ping ? ` • ${latest.ping}ms` : ''}
                    </div>
                  </div>
                </div>
                {latest && <StatusBadge status={latest.status as MonitorStatus} />}
              </div>

              {/* ping URL */}
              <div style={{ padding: '10px 16px', borderBottom: '1px solid #1e1e1e', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: '#555' }}>Ping URL:</span>
                <code style={{ flex: 1, fontSize: 11, color: '#888', background: '#161616', padding: '3px 8px', borderRadius: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pingUrl}
                </code>
                <CopyButton text={pingUrl} />
              </div>

              {/* heartbeat log */}
              <div>
                {monHeartbeats.slice(0, 8).map((hb, idx) => (
                  <div key={hb.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 16px',
                    borderBottom: idx < Math.min(monHeartbeats.length, 8) - 1 ? '1px solid #1a1a1a' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <StatusBadge status={hb.status as MonitorStatus} />
                      {hb.ping > 0 && <span style={{ fontSize: 12, color: '#666' }}>{hb.ping}ms</span>}
                      {hb.message && <span style={{ fontSize: 12, color: '#555' }}>{hb.message}</span>}
                    </div>
                    <span style={{ fontSize: 11, color: '#555' }}>{timeAgo(hb.created_at)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
