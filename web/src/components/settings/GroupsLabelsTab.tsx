import { useState } from 'react'
import { Pencil, Trash2, Loader2, AlertCircle, Check, FolderOpen, Tag, X } from 'lucide-react'
import Card from '@/components/ui/Card'
import {
  useGroupsWithCount,
  useLabelsWithCount,
  useRenameGroup,
  useDeleteGroup,
  useRenameLabel,
  useDeleteLabel,
  type GroupSummary,
  type LabelSummary,
} from '@/hooks/useGroupsLabels'

// ── shared styles ─────────────────────────────────────────────────────────────

const inputStyle = {
  flex: 1,
  background: 'var(--color-input-bg)',
  border: '1px solid var(--color-border)',
  borderRadius: 6,
  color: 'var(--color-text)',
  fontSize: 13,
  padding: '6px 10px',
  outline: 'none',
} as const

function ErrorMsg({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      fontSize: 12, color: '#fc8181',
      background: 'rgba(229,62,62,0.08)',
      border: '1px solid rgba(229,62,62,0.2)',
      borderRadius: 6, padding: '7px 10px', marginTop: 8,
    }}>
      <AlertCircle size={12} /> {msg}
    </div>
  )
}

// ── delete confirm modal ──────────────────────────────────────────────────────

function DeleteModal({
  kind,
  name,
  monitorCount,
  onClose,
  onConfirm,
  busy,
}: {
  kind: 'group' | 'label'
  name: string
  monitorCount: number
  onClose: () => void
  onConfirm: () => void
  busy: boolean
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
      onClick={e => { if (!busy && e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-danger-zone-border)',
        borderRadius: 10, padding: 24, width: 420, maxWidth: '90vw',
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginBottom: 10 }}>
          Delete {kind === 'group' ? 'Group' : 'Label'}
        </div>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: 16 }}>
          {kind === 'group' ? (
            <>
              Remove group <strong style={{ color: 'var(--color-text)' }}>"{name}"</strong> from{' '}
              <strong style={{ color: 'var(--color-text)' }}>{monitorCount}</strong>{' '}
              {monitorCount === 1 ? 'monitor' : 'monitors'}? The monitors will remain but will no longer
              belong to any group.
            </>
          ) : (
            <>
              Remove label <strong style={{ color: 'var(--color-text)' }}>"{name}"</strong> from{' '}
              <strong style={{ color: 'var(--color-text)' }}>{monitorCount}</strong>{' '}
              {monitorCount === 1 ? 'monitor' : 'monitors'}?
            </>
          )}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            disabled={busy}
            style={{
              background: 'none', border: '1px solid var(--color-border)',
              borderRadius: 6, color: 'var(--color-text-muted)', fontSize: 13,
              padding: '7px 16px', cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#e53e3e', border: 'none', borderRadius: 6,
              color: '#fff', fontSize: 13, fontWeight: 500,
              padding: '7px 16px', cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            {busy
              ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
              : <Trash2 size={13} />}
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── inline rename row ─────────────────────────────────────────────────────────

function RenameRow({
  value,
  onSave,
  onCancel,
  saving,
  error,
}: {
  value: string
  onSave: (newName: string) => void
  onCancel: () => void
  saving: boolean
  error: string
}) {
  const [draft, setDraft] = useState(value)

  function handleSave() {
    const trimmed = draft.trim()
    if (!trimmed || trimmed === value) { onCancel(); return }
    onSave(trimmed)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          autoFocus
          style={inputStyle}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') onCancel()
          }}
        />
        <button
          onClick={handleSave}
          disabled={saving || !draft.trim()}
          title="Save"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 30, height: 30, borderRadius: 6,
            background: '#276749', border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
            color: '#fff', flexShrink: 0,
          }}
        >
          {saving
            ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
            : <Check size={13} />}
        </button>
        <button
          onClick={onCancel}
          title="Cancel"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 30, height: 30, borderRadius: 6,
            background: 'none', border: '1px solid var(--color-border)', cursor: 'pointer',
            color: 'var(--color-text-muted)', flexShrink: 0,
          }}
        >
          <X size={13} />
        </button>
      </div>
      {error && <ErrorMsg msg={error} />}
    </div>
  )
}

// ── groups section ────────────────────────────────────────────────────────────

function GroupsSection() {
  const { data: groups = [], isLoading } = useGroupsWithCount()
  const renameGroup = useRenameGroup()
  const deleteGroup = useDeleteGroup()

  const [editingName, setEditingName] = useState<string | null>(null)
  const [renameError, setRenameError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<GroupSummary | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  function handleRename(oldName: string, newName: string) {
    setRenameError('')
    renameGroup.mutate(
      { oldName, newName },
      {
        onSuccess: () => setEditingName(null),
        onError: (err: any) => setRenameError(err?.response?.data?.message ?? 'Failed to rename'),
      },
    )
  }

  function handleDelete() {
    if (!deleteTarget) return
    setDeleteBusy(true)
    deleteGroup.mutate(deleteTarget.name, {
      onSuccess: () => { setDeleteTarget(null); setDeleteBusy(false) },
      onError:   () => setDeleteBusy(false),
    })
  }

  return (
    <>
      <Card style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <FolderOpen size={14} color="#e53e3e" />
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>Groups</div>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 2 }}>
            {groups.length} {groups.length === 1 ? 'group' : 'groups'}
          </span>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text-muted)', fontSize: 13, padding: '8px 0' }}>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
          </div>
        ) : groups.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', padding: '12px 0', textAlign: 'center' }}>
            No groups yet. Assign a group to a monitor to get started.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {groups.map((g) => (
              <div
                key={g.name}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 6,
                }}
              >
                {editingName === g.name ? (
                  <RenameRow
                    value={g.name}
                    onSave={newName => handleRename(g.name, newName)}
                    onCancel={() => { setEditingName(null); setRenameError('') }}
                    saving={renameGroup.isPending}
                    error={renameError}
                  />
                ) : (
                  <>
                    <FolderOpen size={13} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, color: 'var(--color-text)' }}>{g.name}</span>
                    <span style={{
                      fontSize: 11, color: 'var(--color-text-muted)',
                      background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
                      borderRadius: 10, padding: '2px 8px',
                    }}>
                      {g.monitor_count} {g.monitor_count === 1 ? 'monitor' : 'monitors'}
                    </span>
                    <button
                      onClick={() => { setEditingName(g.name); setRenameError('') }}
                      title="Rename"
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--color-text-muted)', padding: '3px 5px', borderRadius: 4,
                        display: 'inline-flex', alignItems: 'center',
                      }}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(g)}
                      title="Delete group"
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--color-text-muted)', padding: '3px 5px', borderRadius: 4,
                        display: 'inline-flex', alignItems: 'center',
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {deleteTarget && (
        <DeleteModal
          kind="group"
          name={deleteTarget.name}
          monitorCount={deleteTarget.monitor_count}
          busy={deleteBusy}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </>
  )
}

// ── labels section ────────────────────────────────────────────────────────────

function labelHue(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return Math.abs(hash) % 360
}

function LabelChip({ name }: { name: string }) {
  const hue = labelHue(name)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, padding: '2px 8px', borderRadius: 10,
      background: `hsl(${hue},55%,88%)`,
      border: `1px solid hsl(${hue},45%,75%)`,
      color: `hsl(${hue},55%,28%)`,
    }}>
      <Tag size={10} />
      {name}
    </span>
  )
}

function LabelsSection() {
  const { data: labels = [], isLoading } = useLabelsWithCount()
  const renameLabel = useRenameLabel()
  const deleteLabel = useDeleteLabel()

  const [editingName, setEditingName] = useState<string | null>(null)
  const [renameError, setRenameError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<LabelSummary | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  function handleRename(oldName: string, newName: string) {
    setRenameError('')
    renameLabel.mutate(
      { oldName, newName },
      {
        onSuccess: () => setEditingName(null),
        onError: (err: any) => setRenameError(err?.response?.data?.message ?? 'Failed to rename'),
      },
    )
  }

  function handleDelete() {
    if (!deleteTarget) return
    setDeleteBusy(true)
    deleteLabel.mutate(deleteTarget.name, {
      onSuccess: () => { setDeleteTarget(null); setDeleteBusy(false) },
      onError:   () => setDeleteBusy(false),
    })
  }

  return (
    <>
      <Card style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Tag size={14} color="#e53e3e" />
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>Labels</div>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 2 }}>
            {labels.length} {labels.length === 1 ? 'label' : 'labels'}
          </span>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text-muted)', fontSize: 13, padding: '8px 0' }}>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
          </div>
        ) : labels.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', padding: '12px 0', textAlign: 'center' }}>
            No labels yet. Add labels to a monitor to get started.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {labels.map((l) => (
              <div
                key={l.name}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 6,
                }}
              >
                {editingName === l.name ? (
                  <RenameRow
                    value={l.name}
                    onSave={newName => handleRename(l.name, newName)}
                    onCancel={() => { setEditingName(null); setRenameError('') }}
                    saving={renameLabel.isPending}
                    error={renameError}
                  />
                ) : (
                  <>
                    <LabelChip name={l.name} />
                    <div style={{ flex: 1 }} />
                    <span style={{
                      fontSize: 11, color: 'var(--color-text-muted)',
                      background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
                      borderRadius: 10, padding: '2px 8px',
                    }}>
                      {l.monitor_count} {l.monitor_count === 1 ? 'monitor' : 'monitors'}
                    </span>
                    <button
                      onClick={() => { setEditingName(l.name); setRenameError('') }}
                      title="Rename"
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--color-text-muted)', padding: '3px 5px', borderRadius: 4,
                        display: 'inline-flex', alignItems: 'center',
                      }}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(l)}
                      title="Delete label"
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--color-text-muted)', padding: '3px 5px', borderRadius: 4,
                        display: 'inline-flex', alignItems: 'center',
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {deleteTarget && (
        <DeleteModal
          kind="label"
          name={deleteTarget.name}
          monitorCount={deleteTarget.monitor_count}
          busy={deleteBusy}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </>
  )
}

// ── exported tab ──────────────────────────────────────────────────────────────

export default function GroupsLabelsTab() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
      <GroupsSection />
      <LabelsSection />
    </div>
  )
}
