type Status = 'up' | 'down' | 'degraded' | 'pending'

const config: Record<Status, { label: string; color: string; bg: string; dot: string }> = {
  up:       { label: 'Up',       color: '#48bb78', bg: 'rgba(72,187,120,0.12)',  dot: '#48bb78' },
  down:     { label: 'Down',     color: '#e53e3e', bg: 'rgba(229,62,62,0.12)',   dot: '#e53e3e' },
  degraded: { label: 'Degraded', color: '#ed8936', bg: 'rgba(237,137,54,0.12)',  dot: '#ed8936' },
  pending:  { label: 'Pending',  color: '#718096', bg: 'rgba(113,128,150,0.12)', dot: '#718096' },
}

export default function StatusBadge({ status }: { status: Status }) {
  const c = config[status] ?? config.pending
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px', borderRadius: 4,
      background: c.bg, color: c.color,
      fontSize: 11, fontWeight: 500,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
      {c.label}
    </span>
  )
}
