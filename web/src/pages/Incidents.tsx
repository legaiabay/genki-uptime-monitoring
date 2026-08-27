import { useState } from 'react'
import { AlertTriangle, CheckCircle, Clock, RefreshCw } from 'lucide-react'
import Card from '@/components/ui/Card'
import { useIncidents, useUpdateIncident } from '@/hooks/useIncidents'
import { useMonitors } from '@/hooks/useMonitors'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import type { IncidentStatus } from '@/types'

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function duration(start: string, end?: string | null) {
  const ms = new Date(end ?? Date.now()).getTime() - new Date(start).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

const statusConfig: Record<IncidentStatus, { label: string; color: string; bg: string; icon: typeof AlertTriangle }> = {
  investigating: { label: 'Investigating', color: '#f6ad55', bg: 'rgba(246,173,85,0.12)', icon: AlertTriangle },
  identified:    { label: 'Identified',    color: '#fc8181', bg: 'rgba(252,129,129,0.12)', icon: AlertTriangle },
  resolved:      { label: 'Resolved',      color: '#68d391', bg: 'rgba(104,211,145,0.12)', icon: CheckCircle },
}

export default function Incidents() {
  const { data: incidents = [], isLoading, refetch } = useIncidents()
  const { data: monitors = [] } = useMonitors()
  const updateMutation = useUpdateIncident()
  const [filter, setFilter] = useState<IncidentStatus | 'all'>('all')
  const { isMobile } = useBreakpoint()

  const filtered = filter === 'all' ? incidents : incidents.filter(i => i.status === filter)

  const tabs: Array<{ value: IncidentStatus | 'all'; label: string }> = [
    { value: 'all',           label: 'All' },
    { value: 'investigating', label: 'Investigating' },
    { value: 'identified',    label: 'Identified' },
    { value: 'resolved',      label: 'Resolved' },
  ]

  const tabColors: Record<string, string> = {
    all: '#888', investigating: '#f6ad55', identified: '#fc8181', resolved: '#68d391',
  }

  return (
    <div style={{ padding: isMobile ? '16px' : '20px 24px' }}>

      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 20,
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-text)', marginBottom: 2 }}>Incidents</h1>
          <p style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>
            {incidents.filter(i => i.status !== 'resolved').length} active incidents
          </p>
        </div>
        <button
          onClick={() => refetch()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text-muted)', fontSize: 12, padding: '6px 10px', cursor: 'pointer' }}
        >
          <RefreshCw size={13} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </div>

      {/* Summary strip */}
      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          {/* Row 1: Active + Identified */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'Active',     count: incidents.filter(i => i.status === 'investigating').length, color: '#f6ad55' },
              { label: 'Identified', count: incidents.filter(i => i.status === 'identified').length,    color: '#fc8181' },
            ].map(s => (
              <Card key={s.label} style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <AlertTriangle size={14} color={s.color} />
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1 }}>{s.count}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>{s.label}</div>
                </div>
              </Card>
            ))}
          </div>
          {/* Row 2: Resolved full width */}
          {(() => {
            const s = { label: 'Resolved', count: incidents.filter(i => i.status === 'resolved').length, color: '#68d391' }
            return (
              <Card key={s.label} style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <AlertTriangle size={14} color={s.color} />
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1 }}>{s.count}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>{s.label}</div>
                </div>
              </Card>
            )
          })()}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Active',     count: incidents.filter(i => i.status === 'investigating').length, color: '#f6ad55' },
            { label: 'Identified', count: incidents.filter(i => i.status === 'identified').length,    color: '#fc8181' },
            { label: 'Resolved',   count: incidents.filter(i => i.status === 'resolved').length,      color: '#68d391' },
          ].map(s => (
            <Card key={s.label} style={{ padding: isMobile ? '12px 14px' : '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={15} color={s.color} />
              </div>
              <div>
                <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1 }}>{s.count}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>{s.label}</div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card>
        {/* Tabs — horizontally scrollable on mobile */}
        <div style={{
          display: 'flex', gap: 4, padding: '12px 16px',
          borderBottom: '1px solid var(--color-border-muted)',
          overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any,
        }}>
          {tabs.map(tab => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              style={{
                padding: '5px 12px', borderRadius: 5, fontSize: 12, cursor: 'pointer',
                border: filter === tab.value ? '1px solid var(--color-border-active)' : '1px solid transparent',
                background: filter === tab.value ? 'var(--color-surface-hover)' : 'transparent',
                color: filter === tab.value ? (tabColors[tab.value] ?? 'var(--color-text)') : 'var(--color-text-muted)',
                fontWeight: filter === tab.value ? 500 : 400,
                whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              {tab.label}
              <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--color-text-muted)' }}>
                {tab.value === 'all' ? incidents.length : incidents.filter(i => i.status === tab.value).length}
              </span>
            </button>
          ))}
        </div>

        {/* Incident list */}
        <div>
          {filtered.length === 0 && (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-dim)', fontSize: 13 }}>
              No incidents found
            </div>
          )}
          {filtered.map((inc, idx) => {
            const cfg = statusConfig[inc.status]
            const Icon = cfg.icon
            const monitor = monitors.find(m => m.id === inc.monitor_id)

            return (
              <div
                key={inc.id}
                style={{
                  padding: isMobile ? '14px' : '16px',
                  borderBottom: idx < filtered.length - 1 ? '1px solid var(--color-row-divider)' : 'none',
                }}
              >
                {/* Top row: icon + content */}
                <div style={{ display: 'flex', gap: 12 }}>
                  {/* Icon */}
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <Icon size={15} color={cfg.color} />
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Title row + status badge */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: isMobile ? 'flex-start' : 'flex-start',
                      gap: 10,
                      marginBottom: 4,
                      flexWrap: isMobile ? 'wrap' : 'nowrap',
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 3,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}>
                          {inc.title}
                        </div>
                        {monitor && (
                          <div style={{ fontSize: 11, color: 'var(--color-text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isMobile ? 'normal' : 'nowrap' }}>
                            Affects: <span style={{ color: 'var(--color-text-muted)' }}>{monitor.name}</span>
                            {!isMobile && ` — ${monitor.url}`}
                          </div>
                        )}
                      </div>

                      <span style={{ fontSize: 11, fontWeight: 500, color: cfg.color, background: cfg.bg, padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {cfg.label}
                      </span>
                    </div>

                    {/* Meta row */}
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-text-dim)' }}>
                        <Clock size={11} />
                        Started {timeAgo(inc.started_at)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>
                        Duration: {duration(inc.started_at, inc.resolved_at)}
                      </div>
                      {inc.resolved_at && (
                        <div style={{ fontSize: 11, color: '#68d391' }}>
                          Resolved {timeAgo(inc.resolved_at)}
                        </div>
                      )}
                    </div>

                    {/* Quick actions — inline on desktop, below meta on mobile */}
                    {inc.status !== 'resolved' && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                        {inc.status === 'investigating' && (
                          <button
                            onClick={() => updateMutation.mutate({ id: inc.id, status: 'identified' })}
                            style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 5, color: '#fc8181', fontSize: 11, padding: '5px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >
                            Mark Identified
                          </button>
                        )}
                        <button
                          onClick={() => updateMutation.mutate({ id: inc.id, status: 'resolved' })}
                          style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 5, color: '#68d391', fontSize: 11, padding: '5px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          Mark Resolved
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
