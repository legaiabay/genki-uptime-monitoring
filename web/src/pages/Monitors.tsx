import { useState, useRef, useEffect } from 'react'
import {
  Plus, Search, MoreVertical, Pencil, Trash2, RefreshCw,
  X, Check, Globe, ExternalLink, Tag, Layers, ChevronDown, ChevronRight,
} from 'lucide-react'
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
  useGroups,
  type CreateMonitorPayload,
} from '@/hooks/useMonitors'
import { useShowURLSetting, useToggleShowURL } from '@/hooks/useShowURLSetting'
import type { Monitor, MonitorStatus } from '@/types'

// ── helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
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

const emptyForm: CreateMonitorPayload = {
  name: '',
  url: '',
  type: 'http',
  interval: 60,
  timeout: 30,
  expected_status: 200,
  max_retries: 1,
  group_name: '',
  labels: [],
}

// ── Label chip ────────────────────────────────────────────────────────────────

function LabelChip({ label, onRemove }: { label: string; onRemove?: () => void }) {
  const color = labelColor(label)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10, fontWeight: 500,
      padding: '2px 7px', borderRadius: 10,
      background: `${color}18`, color,
      border: `1px solid ${color}40`,
      whiteSpace: 'nowrap',
    }}>
      {label}
      {onRemove && (
        <button
          onClick={onRemove}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color, padding: 0, lineHeight: 1, display: 'flex' }}
        >
          <X size={9} />
        </button>
      )}
    </span>
  )
}

// ── Labels input ──────────────────────────────────────────────────────────────

function LabelsInput({
  value,
  onChange,
  inputStyle,
}: {
  value: string[]
  onChange: (labels: string[]) => void
  inputStyle: React.CSSProperties
}) {
  const [draft, setDraft] = useState('')

  function addLabel(raw: string) {
    const trimmed = raw.trim().toLowerCase().replace(/\s+/g, '-')
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed])
    }
    setDraft('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addLabel(draft)
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div style={{
      ...inputStyle,
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5,
      minHeight: 38, padding: '5px 10px', cursor: 'text',
    }}>
      {value.map(l => (
        <LabelChip key={l} label={l} onRemove={() => onChange(value.filter(x => x !== l))} />
      ))}
      <input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (draft.trim()) addLabel(draft) }}
        placeholder={value.length === 0 ? 'Add labels (press Enter or comma)' : ''}
        style={{
          flex: 1, minWidth: 80, background: 'none', border: 'none',
          color: '#e8e8e8', fontSize: 12, outline: 'none',
          padding: 0,
        }}
      />
    </div>
  )
}

// ── Group input with datalist ─────────────────────────────────────────────────

function GroupInput({
  value,
  onChange,
  groups,
  inputStyle,
}: {
  value: string
  onChange: (v: string) => void
  groups: string[]
  inputStyle: React.CSSProperties
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const filtered = groups.filter(g => g.toLowerCase().includes(value.toLowerCase()))
  const showCreate = value.trim() !== '' && !groups.includes(value.trim())

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        style={inputStyle}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="e.g. Production, API, Frontend…"
      />
      {open && (filtered.length > 0 || showCreate) && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 6,
          marginTop: 2, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          {filtered.map(g => (
            <button
              key={g}
              onMouseDown={e => { e.preventDefault(); onChange(g); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '8px 12px', background: 'none',
                border: 'none', color: g === value ? '#e8e8e8' : '#aaa',
                fontSize: 12, cursor: 'pointer', textAlign: 'left',
              }}
            >
              <Layers size={11} color="#555" />{g}
            </button>
          ))}
          {showCreate && (
            <button
              onMouseDown={e => { e.preventDefault(); onChange(value.trim()); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '8px 12px', background: 'none',
                borderTop: filtered.length > 0 ? '1px solid #252525' : 'none',
                border: 'none', color: '#e53e3e',
                fontSize: 12, cursor: 'pointer', textAlign: 'left',
              }}
            >
              <Plus size={11} />Create group &ldquo;{value.trim()}&rdquo;
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function MonitorModal({
  initial,
  onClose,
  onSave,
  loading,
  groups,
}: {
  initial?: Partial<CreateMonitorPayload>
  onClose: () => void
  onSave: (p: CreateMonitorPayload) => void
  loading: boolean
  groups: string[]
}) {
  const [form, setForm] = useState<CreateMonitorPayload>({
    ...emptyForm,
    ...initial,
    labels: initial?.labels ?? [],
    group_name: initial?.group_name ?? '',
  })

  const set = <K extends keyof CreateMonitorPayload>(k: K, v: CreateMonitorPayload[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  const inputStyle = {
    width: '100%', background: '#161616', border: '1px solid #2a2a2a',
    borderRadius: 6, color: '#e8e8e8', fontSize: 13, padding: '8px 12px',
    outline: 'none', boxSizing: 'border-box' as const,
  } as const

  const labelStyle = { fontSize: 12, color: '#888', display: 'block', marginBottom: 6 } as const

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 10,
        width: 520, maxHeight: '90vh', overflowY: 'auto',
      }}>
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
          {/* Name + Group in one row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Name</label>
              <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="My API" />
            </div>
            <div>
              <label style={labelStyle}>Group</label>
              <GroupInput
                value={form.group_name}
                onChange={v => set('group_name', v)}
                groups={groups}
                inputStyle={inputStyle}
              />
            </div>
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

          {/* Labels */}
          <div>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Tag size={11} />Labels
              <span style={{ fontSize: 11, color: '#555', fontWeight: 400 }}>(optional)</span>
            </label>
            <LabelsInput
              value={form.labels}
              onChange={v => set('labels', v)}
              inputStyle={inputStyle}
            />
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
              opacity: !form.name || !form.url ? 0.5 : 1,
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

// ── Column widths (shared across all tables for alignment) ───────────────────

// Monitor | Status | Uptime | Interval | Last Check | Next Check | Public | History | Actions
const COL_WIDTHS = ['auto', '100px', '80px', '76px', '100px', '140px', '80px', '84px', '44px']

function TableColGroup() {
  return (
    <colgroup>
      {COL_WIDTHS.map((w, i) => <col key={i} style={{ width: w }} />)}
    </colgroup>
  )
}

// ── Group section (renders its own mini-table) ────────────────────────────────

function GroupSection({
  groupName,
  monitors,
  onEdit,
  onDelete,
  visibilityMutation,
}: {
  groupName: string
  monitors: Monitor[]
  onEdit: (m: Monitor) => void
  onDelete: (id: number) => void
  visibilityMutation: ReturnType<typeof useToggleVisibility>
}) {
  const [collapsed, setCollapsed] = useState(false)

  const upCount = monitors.filter(m => m.status === 'up').length
  const downCount = monitors.filter(m => m.status === 'down').length

  return (
    <div>
      {/* group header row */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 16px', cursor: 'pointer',
          background: '#161616', borderBottom: collapsed ? 'none' : '1px solid #1e1e1e',
          userSelect: 'none',
        }}
      >
        {collapsed ? <ChevronRight size={12} color="#555" /> : <ChevronDown size={12} color="#555" />}
        <Layers size={12} color="#555" />
        <span style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>{groupName}</span>
        <span style={{ fontSize: 11, color: '#444' }}>{monitors.length} monitor{monitors.length !== 1 ? 's' : ''}</span>
        {downCount > 0 ? (
          <span style={{ fontSize: 10, color: '#e53e3e', background: 'rgba(229,62,62,0.12)', padding: '1px 6px', borderRadius: 8 }}>
            {downCount} down
          </span>
        ) : (
          <span style={{ fontSize: 10, color: '#48bb78', background: 'rgba(72,187,120,0.1)', padding: '1px 6px', borderRadius: 8 }}>
            {upCount} up
          </span>
        )}
      </div>

      {!collapsed && (
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <TableColGroup />
          <tbody>
            {monitors.map((m, idx) => (
              <MonitorRow
                key={m.id}
                m={m}
                isLast={idx === monitors.length - 1}
                onEdit={onEdit}
                onDelete={onDelete}
                visibilityMutation={visibilityMutation}
                indent
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Monitor row ───────────────────────────────────────────────────────────────

function MonitorRow({
  m,
  isLast,
  onEdit,
  onDelete,
  visibilityMutation,
  indent = false,
}: {
  m: Monitor
  isLast: boolean
  onEdit: (m: Monitor) => void
  onDelete: (id: number) => void
  visibilityMutation: ReturnType<typeof useToggleVisibility>
  indent?: boolean
}) {
  const bars = Array(14).fill(m.status === 'pending' ? 'up' : m.status) as MonitorStatus[]

  return (
    <tr style={{ borderBottom: isLast ? 'none' : '1px solid #1e1e1e' }}>
      <td style={{ padding: '11px 20px', paddingLeft: indent ? 36 : 20, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginTop: 4,
            background: m.status === 'up' ? '#48bb78' : m.status === 'down' ? '#e53e3e' : m.status === 'degraded' ? '#ed8936' : '#555',
          }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, color: '#e8e8e8', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
            <div style={{ fontSize: 11, color: '#555', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.url}</div>
            {m.labels.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                {m.labels.map(l => <LabelChip key={l} label={l} />)}
              </div>
            )}
          </div>
        </div>
      </td>
      <td style={{ padding: '11px 20px' }}>
        <StatusBadge status={m.status} />
      </td>
      <td style={{ padding: '11px 20px', fontSize: 13, color: '#888' }}>
        {m.uptime_percentage === 100 ? '100%' : `${m.uptime_percentage.toFixed(2)}%`}
      </td>
      <td style={{ padding: '11px 20px', fontSize: 13, color: '#888' }}>
        {m.interval >= 3600 ? `${m.interval / 3600}h` : m.interval >= 60 ? `${m.interval / 60}m` : `${m.interval}s`}
      </td>
      <td style={{ padding: '11px 20px', fontSize: 12, color: '#555' }}>
        {m.last_checked_at ? timeAgo(m.last_checked_at) : '—'}
      </td>
      <td style={{ padding: '11px 20px' }}>
        <NextCheckBar lastCheckedAt={m.last_checked_at} intervalSeconds={m.interval} />
      </td>
      <td style={{ padding: '11px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            onClick={() => visibilityMutation.mutate({ id: m.id, isPublic: !m.public })}
            title={m.public ? 'Make private' : 'Make public'}
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
              href={m.group_name ? `/status/group/${m.group_name.toLowerCase().replace(/\s+/g, '-')}` : '/status'}
              target="_blank"
              rel="noreferrer"
              style={{ color: '#555', display: 'flex' }}
            >
              <ExternalLink size={11} />
            </a>
          )}
        </div>
      </td>
      <td style={{ padding: '11px 20px' }}>
        <MiniSparkline data={bars} width={56} height={18} />
      </td>
      <td style={{ padding: '11px 20px' }}>
        <RowMenu onEdit={() => onEdit(m)} onDelete={() => onDelete(m.id)} />
      </td>
    </tr>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Monitors() {
  const { data: monitors = [], isLoading, refetch } = useMonitors()
  const { data: groups = [] } = useGroups()
  const createMutation = useCreateMonitor()
  const updateMutation = useUpdateMonitor()
  const deleteMutation = useDeleteMonitor()
  const visibilityMutation = useToggleVisibility()
  const { data: showURL = true } = useShowURLSetting()
  const showURLMutation = useToggleShowURL()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<MonitorStatus | 'all'>('all')
  const [groupFilter, setGroupFilter] = useState<string | null>(null)
  const [labelFilter, setLabelFilter] = useState<string | null>(null)
  const [modal, setModal] = useState<{ open: boolean; monitor?: Monitor }>({ open: false })
  const [viewMode, setViewMode] = useState<'flat' | 'grouped'>('grouped')

  // Collect all unique labels across monitors
  const allLabels = Array.from(new Set(monitors.flatMap(m => m.labels))).sort()

  const filtered = monitors.filter(m => {
    const q = search.toLowerCase()
    const matchSearch = !q || (
      m.name.toLowerCase().includes(q) ||
      m.url.toLowerCase().includes(q) ||
      m.group_name.toLowerCase().includes(q) ||
      m.labels.some(l => l.toLowerCase().includes(q))
    )
    const matchStatus = statusFilter === 'all' || m.status === statusFilter
    const matchGroup = groupFilter === null || m.group_name === groupFilter
    const matchLabel = labelFilter === null || m.labels.includes(labelFilter)
    return matchSearch && matchStatus && matchGroup && matchLabel
  })

  // Group monitors for grouped view
  const grouped: Record<string, Monitor[]> = {}
  const ungrouped: Monitor[] = []
  for (const m of filtered) {
    if (m.group_name) {
      if (!grouped[m.group_name]) grouped[m.group_name] = []
      grouped[m.group_name].push(m)
    } else {
      ungrouped.push(m)
    }
  }

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
    { value: 'all',      label: 'All' },
    { value: 'up',       label: 'Up',       color: '#48bb78' },
    { value: 'down',     label: 'Down',     color: '#e53e3e' },
    { value: 'degraded', label: 'Degraded', color: '#ed8936' },
  ]

  const hasGroups = groups.length > 0
  const hasLabels = allLabels.length > 0

  const tableHeaders = ['Monitor', 'Status', 'Uptime', 'Interval', 'Last Check', 'Next Check', 'Public', 'History', '']

  return (
    <div style={{ padding: '20px 24px', display: 'flex', gap: 16 }}>

      {/* ── Sidebar: group + label filters ── */}
      {(hasGroups || hasLabels) && (
        <div style={{ width: 180, flexShrink: 0 }}>
          {hasGroups && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Layers size={11} />Groups
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <button
                  onClick={() => setGroupFilter(null)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
                    background: groupFilter === null ? '#252525' : 'transparent',
                    color: groupFilter === null ? '#e8e8e8' : '#666',
                    fontSize: 12, textAlign: 'left',
                  }}
                >
                  <span>All groups</span>
                  <span style={{ fontSize: 11, color: '#444' }}>{monitors.length}</span>
                </button>
                {groups.map(g => (
                  <button
                    key={g}
                    onClick={() => setGroupFilter(gf => gf === g ? null : g)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '6px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
                      background: groupFilter === g ? '#252525' : 'transparent',
                      color: groupFilter === g ? '#e8e8e8' : '#666',
                      fontSize: 12, textAlign: 'left',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Layers size={10} color={groupFilter === g ? '#e53e3e' : '#444'} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>{g}</span>
                    </span>
                    <span style={{ fontSize: 11, color: '#444' }}>
                      {monitors.filter(m => m.group_name === g).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasLabels && (
            <div>
              <div style={{ fontSize: 11, color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Tag size={11} />Labels
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {allLabels.map(l => {
                  const color = labelColor(l)
                  const active = labelFilter === l
                  return (
                    <button
                      key={l}
                      onClick={() => setLabelFilter(lf => lf === l ? null : l)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '5px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
                        background: active ? `${color}15` : 'transparent',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: active ? color : '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>{l}</span>
                      </span>
                      <span style={{ fontSize: 11, color: '#444' }}>
                        {monitors.filter(m => m.labels.includes(l)).length}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Main content ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
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
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, color: '#888', fontSize: 12, padding: '6px 10px', textDecoration: 'none' }}
            >
              <Globe size={13} /> Public Page
            </a>
            <button
              onClick={() => showURLMutation.mutate(!showURL)}
              title={showURL ? 'Hide URLs on public page' : 'Show URLs on public page'}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6,
                color: showURL ? '#4299e1' : '#555', fontSize: 12, padding: '6px 10px', cursor: 'pointer',
              }}
            >
              <ExternalLink size={13} />
              {showURL ? 'Hide URL' : 'Show URL'}
            </button>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #222', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {/* status tabs */}
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

              {/* divider */}
              {hasGroups && <div style={{ width: 1, height: 18, background: '#2a2a2a', margin: '0 4px' }} />}

              {/* grouped toggle */}
              {hasGroups && (
                <button
                  onClick={() => setViewMode(v => v === 'grouped' ? 'flat' : 'grouped')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 10px', borderRadius: 5, fontSize: 12, cursor: 'pointer',
                    border: viewMode === 'grouped' ? '1px solid #3a3a3a' : '1px solid transparent',
                    background: viewMode === 'grouped' ? '#252525' : 'transparent',
                    color: viewMode === 'grouped' ? '#e8e8e8' : '#666',
                  }}
                >
                  <Layers size={11} />
                  {viewMode === 'grouped' ? 'Grouped' : 'Flat'}
                </button>
              )}

              {/* active filters */}
              {groupFilter && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#e8e8e8', background: '#252525', border: '1px solid #3a3a3a', borderRadius: 5, padding: '4px 10px' }}>
                  <Layers size={11} color="#e53e3e" />{groupFilter}
                  <button onClick={() => setGroupFilter(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 0, display: 'flex' }}><X size={11} /></button>
                </span>
              )}
              {labelFilter && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, borderRadius: 5, padding: '4px 10px', background: `${labelColor(labelFilter)}18`, color: labelColor(labelFilter), border: `1px solid ${labelColor(labelFilter)}40` }}>
                  <Tag size={11} />{labelFilter}
                  <button onClick={() => setLabelFilter(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: labelColor(labelFilter), padding: 0, display: 'flex' }}><X size={11} /></button>
                </span>
              )}
            </div>

            {/* search */}
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#555' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, URL, group, label…"
                style={{
                  background: '#161616', border: '1px solid #2a2a2a', borderRadius: 6,
                  color: '#e8e8e8', fontSize: 12, padding: '6px 12px 6px 30px',
                  outline: 'none', width: 240,
                }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 0, display: 'flex' }}>
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* table */}
          {viewMode === 'flat' || !hasGroups ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <TableColGroup />
              <thead>
                <tr>
                  {tableHeaders.map(h => (
                    <th key={h} style={{ padding: '8px 20px', textAlign: 'left', fontSize: 11, color: '#555', fontWeight: 500, borderBottom: '1px solid #222' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#555', fontSize: 13 }}>
                      {search || groupFilter || labelFilter ? 'No monitors match your filters' : 'No monitors yet. Add your first monitor.'}
                    </td>
                  </tr>
                )}
                {filtered.map((m, idx) => (
                  <MonitorRow
                    key={m.id}
                    m={m}
                    isLast={idx === filtered.length - 1}
                    onEdit={m => setModal({ open: true, monitor: m })}
                    onDelete={handleDelete}
                    visibilityMutation={visibilityMutation}
                  />
                ))}
              </tbody>
            </table>
          ) : (
            /* grouped view */
            <div>
              {filtered.length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center', color: '#555', fontSize: 13 }}>
                  {search || groupFilter || labelFilter ? 'No monitors match your filters' : 'No monitors yet. Add your first monitor.'}
                </div>
              )}

              {Object.entries(grouped).map(([group, items]) => (
                <GroupSection
                  key={group}
                  groupName={group}
                  monitors={items}
                  onEdit={m => setModal({ open: true, monitor: m })}
                  onDelete={handleDelete}
                  visibilityMutation={visibilityMutation}
                />
              ))}

              {ungrouped.length > 0 && (
                <div>
                  {Object.keys(grouped).length > 0 && (
                    <div style={{ padding: '8px 16px', background: '#161616', borderBottom: '1px solid #1e1e1e', borderTop: '1px solid #1e1e1e', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>Ungrouped</span>
                      <span style={{ fontSize: 11, color: '#444' }}>{ungrouped.length} monitor{ungrouped.length !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <TableColGroup />
                    <thead>
                      <tr>
                        {tableHeaders.map(h => (
                          <th key={h} style={{ padding: '8px 20px', textAlign: 'left', fontSize: 11, color: '#555', fontWeight: 500, borderBottom: '1px solid #222' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ungrouped.map((m, idx) => (
                        <MonitorRow
                          key={m.id}
                          m={m}
                          isLast={idx === ungrouped.length - 1}
                          onEdit={m => setModal({ open: true, monitor: m })}
                          onDelete={handleDelete}
                          visibilityMutation={visibilityMutation}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {modal.open && (
        <MonitorModal
          initial={modal.monitor}
          onClose={() => setModal({ open: false })}
          onSave={handleSave}
          loading={mutating}
          groups={groups}
        />
      )}
    </div>
  )
}
