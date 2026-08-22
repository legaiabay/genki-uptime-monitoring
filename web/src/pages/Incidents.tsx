import { useState } from 'react'
import { AlertTriangle, CheckCircle, Clock, RefreshCw } from 'lucide-react'
import Card from '@/components/ui/Card'
import { useIncidents, useUpdateIncident } from '@/hooks/useIncidents'
import { useMonitors } from '@/hooks/useMonitors'
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
    <div style={{ padding: '20px 24px' }}>
      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#e8e8e8', marginBottom: 2 }}>Incidents</h1>
          <p style={{ fontSize: 12, color: '#555' }}>{incidents.filter(i => i.status !== 'resolved').length} active incidents</p>
        </div>
        <button
          onClick={() => refetch()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, color: '#888', fontSize: 12, padding: '6px 10px', cursor: 'pointer' }}
        >
          <RefreshCw size={13} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </div>

      {/* summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Active', count: incidents.filter(i => i.status === 'investigating').length, color: '#f6ad55' },
          { label: 'Identified', count: incidents.filter(i => i.status === 'identified').length, color: '#fc8181' },
          { label: 'Resolved', count: incidents.filter(i => i.status === 'resolved').length, color: '#68d391' },
        ].map(s => (
          <Card key={s.label} style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={16} color={s.color} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#e8e8e8', lineHeight: 1 }}>{s.count}</div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>{s.label}</div>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        {/* tabs */}
        <div style={{ display: 'flex', gap: 4, padding: '12px 16px', borderBottom: '1px solid #222' }}>
          {tabs.map(tab => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              style={{
                padding: '5px 12px', borderRadius: 5, fontSize: 12, cursor: 'pointer',
                border: filter === tab.value ? '1px solid #3a3a3a' : '1px solid transparent',
                background: filter === tab.value ? '#252525' : 'transparent',
                color: filter === tab.value ? (tabColors[tab.value] ?? '#e8e8e8') : '#666',
                fontWeight: filter === tab.value ? 500 : 400,
              }}
            >
              {tab.label}
              <span style={{ marginLeft: 6, fontSize: 11, color: '#444' }}>
                {tab.value === 'all' ? incidents.length : incidents.filter(i => i.status === tab.value).length}
              </span>
            </button>
          ))}
        </div>

        {/* list */}
        <div>
          {filtered.length === 0 && (
            <div style={{ padding: '48px', textAlign: 'center', color: '#555', fontSize: 13 }}>
              No incidents found
            </div>
          )}
          {filtered.map((inc, idx) => {
            const cfg = statusConfig[inc.status]
            const Icon = cfg.icon
            const monitor = monitors.find(m => m.id === inc.monitor_id)
            return (
              <div key={inc.id} style={{
                padding: '16px',
                borderBottom: idx < filtered.length - 1 ? '1px solid #1e1e1e' : 'none',
                display: 'flex', gap: 14,
              }}>
                {/* icon */}
                <div style={{ width: 32, height: 32, borderRadius: 8, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  <Icon size={15} color={cfg.color} />
                </div>

                {/* content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8e8', marginBottom: 3 }}>{inc.title}</div>
                      {monitor && (
                        <div style={{ fontSize: 11, color: '#555' }}>
                          Affects: <span style={{ color: '#888' }}>{monitor.name}</span> — {monitor.url}
                        </div>
                      )}
                    </div>
                    {/* status badge + actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 500, color: cfg.color, background: cfg.bg, padding: '3px 8px', borderRadius: 4 }}>
                        {cfg.label}
                      </span>
                    </div>
                  </div>

                  {/* meta */}
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#555' }}>
                      <Clock size={11} />
                      Started {timeAgo(inc.started_at)}
                    </div>
                    <div style={{ fontSize: 11, color: '#555' }}>
                      Duration: {duration(inc.started_at, inc.resolved_at)}
                    </div>
                    {inc.resolved_at && (
                      <div style={{ fontSize: 11, color: '#68d391' }}>
                        Resolved {timeAgo(inc.resolved_at)}
                      </div>
                    )}
                  </div>
                </div>

                {/* quick actions */}
                {inc.status !== 'resolved' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    {inc.status === 'investigating' && (
                      <button
                        onClick={() => updateMutation.mutate({ id: inc.id, status: 'identified' })}
                        style={{ background: 'none', border: '1px solid #2a2a2a', borderRadius: 5, color: '#fc8181', fontSize: 11, padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        Mark Identified
                      </button>
                    )}
                    <button
                      onClick={() => updateMutation.mutate({ id: inc.id, status: 'resolved' })}
                      style={{ background: 'none', border: '1px solid #2a2a2a', borderRadius: 5, color: '#68d391', fontSize: 11, padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      Mark Resolved
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
