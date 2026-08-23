import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts'
import {
  Heart, Clock, AlertTriangle,
  RotateCcw, Plus, MoreVertical, ChevronDown, Search, X, Layers,
} from 'lucide-react'
import Card from '@/components/ui/Card'
import StatusBadge from '@/components/ui/StatusBadge'
import MiniSparkline from '@/components/ui/MiniSparkline'
import NextCheckBar from '@/components/ui/NextCheckBar'
import UptimeBars from '@/components/ui/UptimeBars'
import { useOverviewStats } from '@/hooks/useOverviewStats'
import { useMonitors } from '@/hooks/useMonitors'
import { useIncidents } from '@/hooks/useIncidents'
import { useUptimeSeries } from '@/hooks/useUptimeSeries'
import { useAppSettings, useUpdateAppSettings } from '@/hooks/useProfile'
import type { MonitorStatus } from '@/types'

// ── helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

const incidentStatusStyle: Record<string, { color: string; bg: string }> = {
  investigating: { color: '#f6ad55', bg: 'rgba(246,173,85,0.12)' },
  identified:    { color: '#fc8181', bg: 'rgba(252,129,129,0.12)' },
  resolved:      { color: '#68d391', bg: 'rgba(104,211,145,0.12)' },
}

const LABEL_COLORS = [
  '#4299e1', '#48bb78', '#ed8936', '#9f7aea',
  '#f6ad55', '#fc8181', '#68d391', '#76e4f7',
]

function labelColor(label: string) {
  let hash = 0
  for (let i = 0; i < label.length; i++) hash = label.charCodeAt(i) + ((hash << 5) - hash)
  return LABEL_COLORS[Math.abs(hash) % LABEL_COLORS.length]
}

function LabelChip({ label }: { label: string }) {
  const color = labelColor(label)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontSize: 10, fontWeight: 500,
      padding: '1px 6px', borderRadius: 8,
      background: `${color}18`, color,
      border: `1px solid ${color}40`,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

const TIME_RANGES = [
  { label: 'Last 1 hour',   value: '1h'  },
  { label: 'Last 6 hours',  value: '6h'  },
  { label: 'Last 24 hours', value: '24h' },
  { label: 'Last 7 days',   value: '7d'  },
  { label: 'Last 30 days',  value: '30d' },
]

// ── stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, subColor, icon, barData }: {
  label: string; value: string; sub?: string; subColor?: string
  icon: React.ReactNode; barData?: Array<'up' | 'down' | 'degraded'>
}) {
  return (
    <Card style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>{label}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#e8e8e8', lineHeight: 1 }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: subColor ?? '#666', marginTop: 6 }}>{sub}</div>}
        </div>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', flexShrink: 0 }}>
          {icon}
        </div>
      </div>
      {barData && <UptimeBars data={barData} width={160} height={24} />}
    </Card>
  )
}

// ── chart tooltip ─────────────────────────────────────────────────────────────

// ── main ──────────────────────────────────────────────────────────────────────

export default function Overview() {
  const navigate = useNavigate()
  const [timeRange, setTimeRange] = useState('24h')
  const [showTimeDropdown, setShowTimeDropdown] = useState(false)
  const [showIntervalDropdown, setShowIntervalDropdown] = useState(false)
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState<string | null>(null)

  const selectedRange = TIME_RANGES.find(r => r.value === timeRange) ?? TIME_RANGES[2]

  const { data: stats, isFetching: statsFetching, refetch: refetchStats } = useOverviewStats()
  const { data: monitors = [], isFetching: monitorsFetching, refetch: refetchMonitors } = useMonitors()
  const { data: incidents = [] } = useIncidents()
  const { data: series } = useUptimeSeries(timeRange)
  const { data: appSettings } = useAppSettings()
  const updateAppSettings = useUpdateAppSettings()

  const isFetching = statsFetching || monitorsFetching

  const upCount       = monitors.filter(m => m.status === 'up').length
  const downCount     = monitors.filter(m => m.status === 'down').length
  const degradedCount = monitors.filter(m => m.status === 'degraded').length
  const totalCount    = stats?.total_monitors ?? monitors.length

  const allBars = monitors.flatMap(m =>
    Array(5).fill(m.status === 'pending' ? 'up' : m.status)
  ) as Array<'up' | 'down' | 'degraded'>

  // Collect unique groups for quick filter
  const allGroups = Array.from(new Set(monitors.map(m => m.group_name).filter(Boolean))).sort()

  // Filter monitors for the status table
  const filteredMonitors = monitors.filter(m => {
    const q = search.toLowerCase()
    const matchSearch = !q || (
      m.name.toLowerCase().includes(q) ||
      m.url.toLowerCase().includes(q) ||
      m.group_name.toLowerCase().includes(q) ||
      m.labels.some(l => l.toLowerCase().includes(q))
    )
    const matchGroup = groupFilter === null || m.group_name === groupFilter
    return matchSearch && matchGroup
  })

  // Build uptime chart from time-series API
  const activeMonitors = monitors.filter(m => m.active)

  // Build recharts-compatible data: [{time, "Monitor A": 100, "Monitor B": 95, ...}, ...]
  const chartData = (series?.labels ?? []).map((label, i) => {
    const point: Record<string, string | number> = { time: label }
    for (const mon of series?.monitors ?? []) {
      point[mon.name] = mon.values[i] ?? 100
    }
    return point
  })

  const hasSeriesData = chartData.length > 1

  function handleRefresh() {
    refetchStats()
    refetchMonitors()
  }

  return (
    <div style={{ padding: '20px 24px', minHeight: '100%', position: 'relative' }}>

      {/* Loading bar */}
      {isFetching && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: 2, zIndex: 999,
          background: 'linear-gradient(90deg, #e53e3e 0%, #fc8181 50%, #e53e3e 100%)',
          backgroundSize: '200% 100%',
          animation: 'loadingBar 1.2s linear infinite',
        }} />
      )}

      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#e8e8e8', marginBottom: 2 }}>Overview</h1>
          <p style={{ fontSize: 12, color: '#555' }}>System health at a glance</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {appSettings?.default_interval && (() => {
            const secs = parseInt(appSettings.default_interval, 10)
            const intervalLabel = secs >= 60 ? `${secs / 60}m` : `${secs}s`
            const INTERVAL_OPTIONS = [
              { label: '30 seconds', value: '30' },
              { label: '1 minute',   value: '60' },
              { label: '2 minutes',  value: '120' },
              { label: '5 minutes',  value: '300' },
              { label: '10 minutes', value: '600' },
              { label: '30 minutes', value: '1800' },
            ]
            return (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowIntervalDropdown(o => !o)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, color: '#888', fontSize: 12, padding: '6px 12px', cursor: 'pointer' }}
                >
                  <Clock size={13} />Check interval: <span style={{ color: '#e8e8e8', fontWeight: 500 }}>{intervalLabel}</span><ChevronDown size={12} />
                </button>
                {showIntervalDropdown && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setShowIntervalDropdown(false)} />
                    <div style={{ position: 'absolute', top: 34, right: 0, zIndex: 10, background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 6, minWidth: 160, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                      {INTERVAL_OPTIONS.map(opt => (
                        <button key={opt.value}
                          onClick={() => {
                            updateAppSettings.mutate({ default_interval: opt.value })
                            setShowIntervalDropdown(false)
                          }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', background: opt.value === appSettings.default_interval ? '#2a2a2a' : 'none', border: 'none', color: opt.value === appSettings.default_interval ? '#e8e8e8' : '#888', fontSize: 12, cursor: 'pointer' }}
                        >{opt.label}</button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )
          })()}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowTimeDropdown(o => !o)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, color: '#888', fontSize: 12, padding: '6px 12px', cursor: 'pointer' }}
            >
              <Clock size={13} />{selectedRange.label}<ChevronDown size={12} />
            </button>
            {showTimeDropdown && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setShowTimeDropdown(false)} />
                <div style={{ position: 'absolute', top: 34, right: 0, zIndex: 10, background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 6, minWidth: 150, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                  {TIME_RANGES.map(r => (
                    <button key={r.value}
                      onClick={() => { setTimeRange(r.value); setShowTimeDropdown(false); refetchStats(); refetchMonitors() }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', background: r.value === timeRange ? '#2a2a2a' : 'none', border: 'none', color: r.value === timeRange ? '#e8e8e8' : '#888', fontSize: 12, cursor: 'pointer' }}
                    >{r.label}</button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button onClick={handleRefresh} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, color: '#888', fontSize: 12, padding: '6px 10px', cursor: 'pointer' }}>
            <RotateCcw size={13} style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button onClick={() => navigate('/monitors')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#e53e3e', border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 500, padding: '6px 14px', cursor: 'pointer' }}>
            <Plus size={13} />Add Monitor
          </button>
        </div>
      </div>

      {/* ── Uptime chart — full width, all active monitors ── */}
      <Card style={{ padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e8e8' }}>Uptime — All Monitors</span>
            <span style={{ fontSize: 12, color: '#555', marginLeft: 10 }}>{selectedRange.label}</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#e8e8e8' }}>
            {stats ? `${stats.uptime_percentage.toFixed(2)}%` : '—'}
          </div>
        </div>

        {activeMonitors.length === 0 ? (
          <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontSize: 12 }}>
            No active monitors
          </div>
        ) : !hasSeriesData ? (
          <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontSize: 12 }}>
            Not enough data yet — waiting for checks to complete
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid stroke="#1e1e1e" vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fill: '#444', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: '#222' }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: '#444', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
                width={36}
                tickFormatter={v => `${v}%`}
                ticks={[0, 25, 50, 75, 100]}
              />
              <ReferenceLine y={100} stroke="#1e1e1e" strokeDasharray="3 3" />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div style={{ background: '#1e1e1e', border: '1px solid #333', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
                      <div style={{ color: '#888', marginBottom: 6, fontSize: 11 }}>{label}</div>
                      {payload.map((p: any) => (
                        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.stroke, flexShrink: 0 }} />
                          <span style={{ color: '#888' }}>{p.name}:</span>
                          <span style={{ color: '#e8e8e8', fontWeight: 600 }}>{p.value}%</span>
                        </div>
                      ))}
                    </div>
                  )
                }}
              />
              {(series?.monitors ?? []).map(mon => (
                <Line
                  key={mon.id}
                  type="monotone"
                  dataKey={mon.name}
                  stroke={mon.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}

        {/* Per-monitor legend */}
        {(series?.monitors ?? []).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: 10 }}>
            {series!.monitors.map(mon => {
              const live = monitors.find(m => m.id === mon.id)
              return (
                <div key={mon.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 16, height: 2, borderRadius: 1, background: mon.color, display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: '#666' }}>{mon.name}</span>
                  <span style={{ fontSize: 10, color: '#888', fontWeight: 600 }}>
                    {live ? `${live.uptime_percentage.toFixed(2)}%` : ''}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        <Card style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <DonutChart up={upCount} degraded={degradedCount} down={downCount} total={totalCount} size={72} strokeWidth={7} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { label: 'Up',       count: upCount,       color: '#48bb78' },
              { label: 'Degraded', count: degradedCount, color: '#ed8936' },
              { label: 'Down',     count: downCount,     color: '#e53e3e' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#666', width: 50 }}>{item.label}</span>
                <span style={{ fontSize: 12, color: '#e8e8e8', fontWeight: 600 }}>{item.count}</span>
              </div>
            ))}
          </div>
        </Card>
        <StatCard label="Uptime (24h)" value={stats ? `${stats.uptime_percentage.toFixed(2)}%` : '—'} icon={<Heart size={16} />} barData={allBars.slice(0, 30)} />
        <StatCard label="Avg. Response Time" value={stats ? `${stats.avg_response_time}ms` : '—'} icon={<Clock size={16} />} barData={allBars.slice(0, 30)} />
        <StatCard
          label="Incidents"
          value={String(stats?.incident_count ?? incidents.length)}
          sub={`${incidents.filter(i => i.status !== 'resolved').length} active`}
          subColor="#ed8936"
          icon={<AlertTriangle size={16} />}
        />
      </div>

      {/* main content — monitors + incidents side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>

        {/* Monitors table */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px 10px' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e8e8' }}>Monitors Status</span>
            <button onClick={() => navigate('/monitors')} style={{ background: 'none', border: 'none', color: '#666', fontSize: 12, cursor: 'pointer' }}>View all</button>
          </div>

          {/* search + group filter */}
          <div style={{ display: 'flex', gap: 8, padding: '0 16px 10px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
              <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#555' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search monitors…"
                style={{
                  width: '100%', background: '#161616', border: '1px solid #2a2a2a',
                  borderRadius: 6, color: '#e8e8e8', fontSize: 12,
                  padding: '5px 28px 5px 26px', outline: 'none', boxSizing: 'border-box',
                }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 0, display: 'flex' }}>
                  <X size={11} />
                </button>
              )}
            </div>
            {allGroups.length > 0 && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setGroupFilter(null)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '4px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer',
                    border: groupFilter === null ? '1px solid #3a3a3a' : '1px solid transparent',
                    background: groupFilter === null ? '#252525' : 'transparent',
                    color: groupFilter === null ? '#e8e8e8' : '#666',
                  }}
                >
                  All
                </button>
                {allGroups.map(g => (
                  <button
                    key={g}
                    onClick={() => setGroupFilter(gf => gf === g ? null : g)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '4px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer',
                      border: groupFilter === g ? '1px solid #3a3a3a' : '1px solid transparent',
                      background: groupFilter === g ? '#252525' : 'transparent',
                      color: groupFilter === g ? '#e8e8e8' : '#666',
                    }}
                  >
                    <Layers size={10} color={groupFilter === g ? '#e53e3e' : '#444'} />
                    {g}
                  </button>
                ))}
              </div>
            )}
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Monitor', 'Status', 'Uptime', 'Response Time', 'Last Check', 'Next Check', ''].map(h => (
                  <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, color: '#555', fontWeight: 500, borderTop: '1px solid #222', borderBottom: '1px solid #222' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredMonitors.slice(0, 8).map((m, idx) => {
                const bars = Array(14).fill(m.status === 'pending' ? 'up' : m.status) as MonitorStatus[]
                return (
                  <tr key={m.id} style={{ borderBottom: idx < Math.min(filteredMonitors.length, 8) - 1 ? '1px solid #1e1e1e' : 'none' }}>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ fontSize: 13, color: '#e8e8e8', fontWeight: 500 }}>{m.name}</div>
                      <div style={{ fontSize: 11, color: '#555', marginTop: 1 }}>{m.url}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                        {m.group_name && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#666', background: '#1e1e1e', padding: '1px 6px', borderRadius: 8, border: '1px solid #2a2a2a' }}>
                            <Layers size={9} color="#555" />{m.group_name}
                          </span>
                        )}
                        {m.labels.map(l => <LabelChip key={l} label={l} />)}
                      </div>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <StatusBadge status={m.status} />
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: '#888' }}>
                      {m.uptime_percentage === 100 ? '100%' : `${m.uptime_percentage.toFixed(2)}%`}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: '#888' }}>
                      {m.last_response_time != null ? `${m.last_response_time}ms` : '—'}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: '#555' }}>
                      {m.last_checked_at ? timeAgo(m.last_checked_at) : '—'}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <NextCheckBar lastCheckedAt={m.last_checked_at} intervalSeconds={m.interval} />
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <MiniSparkline data={bars} width={56} height={18} />
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#444', padding: 2 }}>
                          <MoreVertical size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredMonitors.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '24px 16px', textAlign: 'center', color: '#555', fontSize: 12 }}>
                    No monitors match your search
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {(monitors.length > 8 || filteredMonitors.length > 8) && (
            <div style={{ padding: '10px 16px', borderTop: '1px solid #1e1e1e', display: 'flex', justifyContent: 'center' }}>
              <button onClick={() => navigate('/monitors')} style={{ background: 'none', border: 'none', color: '#666', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                View all monitors <ChevronDown size={12} />
              </button>
            </div>
          )}
        </Card>

        {/* Incidents */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px 10px' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e8e8' }}>Incidents</span>
            <button onClick={() => navigate('/incidents')} style={{ background: 'none', border: 'none', color: '#666', fontSize: 12, cursor: 'pointer' }}>View all</button>
          </div>
          <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {incidents.slice(0, 3).map(inc => {
              const st = incidentStatusStyle[inc.status] ?? incidentStatusStyle.investigating
              return (
                <div key={inc.id} style={{ padding: '10px 12px', background: '#161616', borderRadius: 6, borderLeft: `3px solid ${st.color}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <AlertTriangle size={12} color={st.color} />
                    <span style={{ fontSize: 12, color: '#e8e8e8', fontWeight: 500 }}>{inc.title}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 500, color: st.color, background: st.bg, padding: '1px 6px', borderRadius: 3, textTransform: 'capitalize' }}>
                      {inc.status}
                    </span>
                    <span style={{ fontSize: 11, color: '#555' }}>Started {timeAgo(inc.started_at)}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#555', marginTop: 3 }}>Affects 1 monitor</div>
                </div>
              )
            })}
            {incidents.length === 0 && (
              <div style={{ fontSize: 12, color: '#555', textAlign: 'center', padding: '16px 0' }}>No active incidents</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

// ── DonutChart ────────────────────────────────────────────────────────────────

function DonutChart({ up, degraded, down, total, size = 112, strokeWidth = 10 }: {
  up: number; degraded: number; down: number; total: number
  size?: number; strokeWidth?: number
}) {
  const half = size / 2
  const r = half - strokeWidth - 2
  const cx = half, cy = half
  const circumference = 2 * Math.PI * r
  const safeTotal = total || 1
  const segments = [
    { value: up,       color: '#48bb78' },
    { value: degraded, color: '#ed8936' },
    { value: down,     color: '#e53e3e' },
  ]
  const activeSegments = segments.filter(s => s.value > 0)
  const gap = activeSegments.length > 1 ? 2 : 0
  let offset = 0
  const arcs = segments.map(seg => {
    const dash = Math.max(0, (seg.value / safeTotal) * circumference - gap)
    const arc = { ...seg, dash, offset }
    offset += (seg.value / safeTotal) * circumference
    return arc
  })
  const fontSize = size < 90 ? 13 : 20
  const subFontSize = size < 90 ? 8 : 10
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#222" strokeWidth={strokeWidth} />
      {arcs.map((arc, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={arc.color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
          strokeDashoffset={circumference / 4 - arc.offset}
          strokeLinecap="butt"
        />
      ))}
      <text x={cx} y={cy - 3} textAnchor="middle" fill="#e8e8e8" fontSize={fontSize} fontWeight={700}>{total}</text>
      <text x={cx} y={cy + subFontSize + 3} textAnchor="middle" fill="#555" fontSize={subFontSize}>Total</text>
    </svg>
  )
}

// suppress unused warning
void 0
