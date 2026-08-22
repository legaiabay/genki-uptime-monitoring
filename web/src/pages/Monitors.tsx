import { useState } from 'react'
import { Plus, Search, MoreVertical, Pencil, Trash2, RefreshCw, X, Check, Globe, ExternalLink } from 'lucide-react'
import Card from '@/components/ui/Card'
import StatusBadge from '@/components/ui/StatusBadge'
import MiniSparkline from '@/components/ui/MiniSparkline'
import NextCheckBar from '@/components/ui/NextCheckBar'
import {
  useMonitors,
  useCreateMonitor,
  useUpdateMonitor,
  useDeleteMonitor,
  useToggleVisibility,
  type CreateMonitorPayload,
} from '@/hooks/useMonitors'
import type { Monitor, MonitorStatus } from '@/types'

// ── helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

const emptyForm: CreateMonitorPayload = {
  name: '',
  url: '',
  type: 'http',
  interval: 60,
  timeout: 30,
  expected_status: 200,
  max_retries: 1,
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function MonitorModal({
  initial,
  onClose,
  onSave,
  loading,
}: {
  initial?: Partial<CreateMonitorPayload>
  onClose: () => void
  onSave: (p: CreateMonitorPayload) => void
  loading: boolean
}) {
  const [form, setForm] = useState<CreateMonitorPayload>({ ...emptyForm, ...initial })

  const set = (k: keyof CreateMonitorPayload, v: string | number) =>
    setForm(f => ({ ...f, [k]: v }))

  const inputStyle = {
    width: '100%', background: '#161616', border: '1px solid #2a2a2a',
    borderRadius: 6, color: '#e8e8e8', fontSize: 13, padding: '8px 12px',
    outline: 'none',
  } as const

  const labelStyle = { fontSize: 12, color: '#888', display: 'block', marginBottom: 6 } as const

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 10, width: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        {/* header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #222' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#e8e8e8' }}>
            {initial?.name ? 'Edit Monitor' : 'Add Monitor'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>

        {/* body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Name</label>
            <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="My API" />
          </div>
          <div>
            <label style={labelStyle}>URL</label>
            <input style={inputStyle} value={form.url} onChange={e => set('url', e.target.value)} placeholder="https://example.com/health" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Monitor Type</label>
              <select
                style={{ ...inputStyle, cursor: 'pointer' }}
                value={form.type}
                onChange={e => set('type', e.target.value as 'http' | 'tcp' | 'ping')}
              >
                <option value="http">HTTP / HTTPS</option>
                <option value="tcp">TCP Port</option>
                <option value="ping">Ping</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Expected Status</label>
              <input style={inputStyle} type="number" value={form.expected_status} onChange={e => set('expected_status', Number(e.target.value))} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Interval (s)</label>
              <input style={inputStyle} type="number" value={form.interval} onChange={e => set('interval', Number(e.target.value))} />
            </div>
            <div>
              <label style={labelStyle}>Timeout (s)</label>
              <input style={inputStyle} type="number" value={form.timeout} onChange={e => set('timeout', Number(e.target.value))} />
            </div>
            <div>
              <label style={labelStyle}>Max Retries</label>
              <input style={inputStyle} type="number" value={form.max_retries} onChange={e => set('max_retries', Number(e.target.value))} />
            </div>
          </div>
        </div>

        {/* footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 20px', borderTop: '1px solid #222' }}>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #2a2a2a', borderRadius: 6, color: '#888', fontSize: 13, padding: '7px 16px', cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={loading || !form.name || !form.url}
            style={{
              background: loading ? '#8B1A1A' : '#e53e3e', border: 'none', borderRadius: 6,
              color: '#fff', fontSize: 13, fontWeight: 500,
              padding: '7px 20px', cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {loading ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={13} />}
            {initial?.name ? 'Save Changes' : 'Add Monitor'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Row menu ──────────────────────────────────────────────────────────────────

function RowMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#444', padding: '2px 4px' }}
      >
        <MoreVertical size={14} />
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', right: 0, top: 24, zIndex: 10,
            background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 6,
            minWidth: 130, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}>
            <button onClick={() => { onEdit(); setOpen(false) }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 14px', background: 'none', border: 'none', color: '#e8e8e8', fontSize: 12, cursor: 'pointer', textAlign: 'left' }}>
              <Pencil size={12} color="#888" /> Edit
            </button>
            <button onClick={() => { onDelete(); setOpen(false) }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 14px', background: 'none', border: 'none', color: '#e53e3e', fontSize: 12, cursor: 'pointer', textAlign: 'left' }}>
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Monitors() {
  const { data: monitors = [], isLoading, refetch } = useMonitors()
  const createMutation = useCreateMonitor()
  const updateMutation = useUpdateMonitor()
  const deleteMutation = useDeleteMonitor()
  const visibilityMutation = useToggleVisibility()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<MonitorStatus | 'all'>('all')
  const [modal, setModal] = useState<{ open: boolean; monitor?: Monitor }>({ open: false })

  const filtered = monitors.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase()) || m.url.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || m.status === statusFilter
    return matchSearch && matchStatus
  })

  async function handleSave(payload: CreateMonitorPayload) {
    if (modal.monitor) {
      await updateMutation.mutateAsync({ id: modal.monitor.id, payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
    setModal({ open: false })
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this monitor?')) return
    await deleteMutation.mutateAsync(id)
  }

  const mutating = createMutation.isPending || updateMutation.isPending

  const statusTabs: Array<{ value: MonitorStatus | 'all'; label: string; color?: string }> = [
    { value: 'all',       label: 'All' },
    { value: 'up',        label: 'Up',       color: '#48bb78' },
    { value: 'down',      label: 'Down',     color: '#e53e3e' },
    { value: 'degraded',  label: 'Degraded', color: '#ed8936' },
  ]

  return (
    <div style={{ padding: '20px 24px' }}>
      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#e8e8e8', marginBottom: 2 }}>Monitors</h1>
          <p style={{ fontSize: 12, color: '#555' }}>{monitors.length} monitors configured</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a
            href="/status"
            target="_blank"
            rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, color: '#888', fontSize: 12, padding: '6px 10px', textDecoration: 'none', cursor: 'pointer' }}
          >
            <Globe size={13} /> Public Page
          </a>
          <button
            onClick={() => refetch()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, color: '#888', fontSize: 12, padding: '6px 10px', cursor: 'pointer' }}
          >
            <RefreshCw size={13} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button
            onClick={() => setModal({ open: true })}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#e53e3e', border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 500, padding: '6px 14px', cursor: 'pointer' }}
          >
            <Plus size={13} /> Add Monitor
          </button>
        </div>
      </div>

      <Card>
        {/* toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #222', gap: 12 }}>
          {/* status tabs */}
          <div style={{ display: 'flex', gap: 4 }}>
            {statusTabs.map(tab => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                style={{
                  padding: '5px 12px', borderRadius: 5, fontSize: 12, cursor: 'pointer',
                  border: statusFilter === tab.value ? '1px solid #3a3a3a' : '1px solid transparent',
                  background: statusFilter === tab.value ? '#252525' : 'transparent',
                  color: statusFilter === tab.value ? (tab.color ?? '#e8e8e8') : '#666',
                  fontWeight: statusFilter === tab.value ? 500 : 400,
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                {tab.color && <span style={{ width: 6, height: 6, borderRadius: '50%', background: tab.color }} />}
                {tab.label}
                <span style={{ fontSize: 11, color: '#444', marginLeft: 2 }}>
                  {tab.value === 'all' ? monitors.length : monitors.filter(m => m.status === tab.value).length}
                </span>
              </button>
            ))}
          </div>
          {/* search */}
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#555' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search monitors..."
              style={{
                background: '#161616', border: '1px solid #2a2a2a', borderRadius: 6,
                color: '#e8e8e8', fontSize: 12, padding: '6px 12px 6px 30px',
                outline: 'none', width: 220,
              }}
            />
          </div>
        </div>

        {/* table */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Monitor', 'Status', 'Uptime', 'Interval', 'Last Check', 'Next Check', 'Public', 'History', ''].map(h => (
                <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, color: '#555', fontWeight: 500, borderBottom: '1px solid #222' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#555', fontSize: 13 }}>
                  {search ? 'No monitors match your search' : 'No monitors yet. Add your first monitor.'}
                </td>
              </tr>
            )}
            {filtered.map((m, idx) => {
              const bars = Array(14).fill(m.status === 'pending' ? 'up' : m.status) as MonitorStatus[]
              return (
                <tr key={m.id} style={{ borderBottom: idx < filtered.length - 1 ? '1px solid #1e1e1e' : 'none' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: m.status === 'up' ? '#48bb78' : m.status === 'down' ? '#e53e3e' : m.status === 'degraded' ? '#ed8936' : '#555' }} />
                      <div>
                        <div style={{ fontSize: 13, color: '#e8e8e8', fontWeight: 500 }}>{m.name}</div>
                        <div style={{ fontSize: 11, color: '#555', marginTop: 1 }}>{m.url}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <StatusBadge status={m.status} />
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#888' }}>
                    {m.uptime_percentage === 100 ? '100%' : `${m.uptime_percentage.toFixed(2)}%`}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#888' }}>
                    {m.interval >= 3600 ? `${m.interval / 3600}h` : m.interval >= 60 ? `${m.interval / 60}m` : `${m.interval}s`}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#555' }}>
                    {m.last_checked_at ? timeAgo(m.last_checked_at) : '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <NextCheckBar lastCheckedAt={m.last_checked_at} intervalSeconds={m.interval} />
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {/* Public toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div
                        onClick={() => visibilityMutation.mutate({ id: m.id, isPublic: !m.public })}
                        style={{
                          width: 32, height: 18, borderRadius: 9, cursor: 'pointer',
                          background: m.public ? '#e53e3e' : '#2a2a2a',
                          position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                        }}
                      >
                        <div style={{
                          width: 12, height: 12, borderRadius: '50%', background: '#fff',
                          position: 'absolute', top: 3,
                          left: m.public ? 17 : 3, transition: 'left 0.2s',
                        }} />
                      </div>
                      {m.public && m.public_slug && (
                        <a
                          href={`/status`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#555', display: 'flex' }}
                        >
                          <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <MiniSparkline data={bars} width={56} height={18} />
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <RowMenu
                      onEdit={() => setModal({ open: true, monitor: m })}
                      onDelete={() => handleDelete(m.id)}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>

      {modal.open && (
        <MonitorModal
          initial={modal.monitor}
          onClose={() => setModal({ open: false })}
          onSave={handleSave}
          loading={mutating}
        />
      )}
    </div>
  )
}
