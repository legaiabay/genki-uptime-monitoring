import { useEffect, useState } from 'react'
import {
  Bell, Globe, MessageCircle, Check,
  ChevronDown, ChevronUp, Info, Send, Loader2,
  CheckCircle, AlertCircle,
} from 'lucide-react'
import Card from '@/components/ui/Card'
import {
  useNotificationChannels,
  useUpsertChannel,
  useSetChannelEnabled,
  type ChannelType,
} from '@/hooks/useNotifications'
import { useBreakpoint } from '@/hooks/useBreakpoint'

// ── styles ────────────────────────────────────────────────────────────────────

const inputStyle = {
  width: '100%', background: 'var(--color-input-bg)', border: '1px solid var(--color-border)',
  borderRadius: 6, color: 'var(--color-text)', fontSize: 13, padding: '8px 12px', outline: 'none',
} as const

const textareaStyle = {
  ...inputStyle, resize: 'vertical' as const,
  minHeight: 72, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5,
}

const labelStyle = { fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 } as const

const DEFAULT_DOWN_MSG     = '🔴 *{{monitor_name}}* is *down*\nURL: {{monitor_url}}\nError: {{error_message}}\nAt: {{checked_at}}'
const DEFAULT_RECOVERY_MSG = '✅ *{{monitor_name}}* has *recovered*\nURL: {{monitor_url}}\nResponse: {{response_time}}ms\nDowntime: {{downtime_duration}}\nAt: {{checked_at}}'

const TEMPLATE_VARS = [
  { var: '{{monitor_name}}',      desc: 'Monitor name' },
  { var: '{{monitor_url}}',       desc: 'Monitor URL' },
  { var: '{{status}}',            desc: 'Current status (up/down/degraded)' },
  { var: '{{response_time}}',     desc: 'Response time in ms' },
  { var: '{{error_message}}',     desc: 'Error or HTTP status message when down' },
  { var: '{{checked_at}}',        desc: 'Timestamp of the check' },
  { var: '{{downtime_duration}}', desc: 'How long the monitor was down (recovery only)' },
]

function renderMsg(tmpl: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{{${k}}}`, v), tmpl)
}

const SAMPLE_DOWN = {
  monitor_name:  'Test Monitor',
  monitor_url:   'https://example.com/health',
  status:        'down',
  response_time: '0',
  error_message: 'Connection refused',
  checked_at:    new Date().toISOString(),
}

const SAMPLE_RECOVERY = {
  monitor_name:      'Test Monitor',
  monitor_url:       'https://example.com/health',
  status:            'up',
  response_time:     '124',
  error_message:     '',
  checked_at:        new Date().toISOString(),
  downtime_duration: '5m 30s',
}

// ── sub-components ────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!checked)} style={{
      width: 36, height: 20, borderRadius: 10, cursor: 'pointer',
      background: checked ? '#e53e3e' : '#2a2a2a',
      position: 'relative', transition: 'background 0.2s', flexShrink: 0,
    }}>
      <div style={{
        width: 14, height: 14, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 3, left: checked ? 19 : 3, transition: 'left 0.2s',
      }} />
    </div>
  )
}

function TemplateVarsHelp({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <div style={{ marginTop: 6 }}>
      <button onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--color-text-dim)', fontSize: 11, cursor: 'pointer', padding: 0 }}>
        <Info size={11} /> Available variables {show ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>
      {show && (
        <div style={{ marginTop: 6, background: 'var(--color-bg-deep)', border: '1px solid var(--color-border-subtle)', borderRadius: 6, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {TEMPLATE_VARS.map(v => (
            <div key={v.var} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <code style={{ fontSize: 10, color: '#e53e3e', background: 'var(--color-surface-2)', padding: '1px 5px', borderRadius: 3, flexShrink: 0 }}>{v.var}</code>
              <span style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>{v.desc}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type TestState = 'idle' | 'sending' | 'success' | 'error'

function TestButton({
  label, icon, state, error, onClick, disabled,
}: {
  label: string; icon: React.ReactNode
  state: TestState; error?: string
  onClick: () => void; disabled?: boolean
}) {
  const bg    = state === 'success' ? '#276749' : state === 'error' ? '#7B1C1C' : 'var(--color-surface-2)'
  const bc    = state === 'success' ? '#276749' : state === 'error' ? '#7B1C1C' : 'var(--color-border)'
  const color = state === 'error' ? '#fc8181' : state === 'success' ? '#68d391' : 'var(--color-text-muted)'
  return (
    <button
      onClick={onClick}
      disabled={disabled || state === 'sending'}
      title={state === 'error' && error ? error : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        background: bg, border: `1px solid ${bc}`, borderRadius: 6,
        color, fontSize: 12, padding: '6px 12px',
        cursor: disabled || state === 'sending' ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1, transition: 'background 0.15s',
      }}
    >
      {state === 'sending' ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
        : state === 'success' ? <CheckCircle size={12} />
        : state === 'error'   ? <AlertCircle size={12} />
        : icon}
      {state === 'sending' ? 'Sending…'
        : state === 'success' ? 'Sent!'
        : state === 'error'   ? 'Failed'
        : label}
    </button>
  )
}

function ChannelCard({ icon, title, desc, enabled, onToggle, children }: {
  icon: React.ReactNode; title: string; desc: string
  enabled: boolean; onToggle: (v: boolean) => void; children?: React.ReactNode
}) {
  return (
    <Card style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: enabled && children ? 16 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(229,62,62,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {icon}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{title}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>{desc}</div>
          </div>
        </div>
        <Toggle checked={enabled} onChange={onToggle} />
      </div>
      {enabled && children && <div>{children}</div>}
    </Card>
  )
}

// ── WebhookPayloadPreview ─────────────────────────────────────────────────────

const WEBHOOK_PAYLOAD_DOWN = {
  event: 'down',
  monitor_name: 'My API',
  monitor_url: 'https://api.example.com/health',
  status: 'down',
  response_time: 0,
  error_message: 'Connection refused',
  checked_at: '2026-08-23T10:00:00Z',
  message: '🔴 My API is down\nURL: https://api.example.com/health\nError: Connection refused',
}

function WebhookPayloadPreview() {
  const [show, setShow] = useState(false)
  return (
    <div style={{ marginTop: 2 }}>
      <button
        onClick={() => setShow(s => !s)}
        style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--color-text-dim)', fontSize: 11, cursor: 'pointer', padding: 0 }}
      >
        <Info size={11} /> Example payload {show ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>
      {show && (
        <div style={{ marginTop: 6, background: 'var(--color-bg-deep)', border: '1px solid var(--color-border-subtle)', borderRadius: 6, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginBottom: 6 }}>
            POST <code style={{ color: 'var(--color-text-muted)' }}>application/json</code> — sent on every status change
          </div>
          <pre style={{ margin: 0, fontSize: 11, color: '#a0aec0', lineHeight: 1.6, overflowX: 'auto' }}>
            {JSON.stringify(WEBHOOK_PAYLOAD_DOWN, null, 2)}
          </pre>
          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--color-text-dim)' }}>
            <code style={{ color: '#e53e3e' }}>event</code> is <code style={{ color: '#68d391' }}>"down"</code> or <code style={{ color: '#68d391' }}>"recovery"</code> — use it to branch your handler logic.
          </div>
        </div>
      )}
    </div>
  )
}

// ── WebhookChannelForm ────────────────────────────────────────────────────────

interface WebhookFormProps {
  chType: ChannelType
  icon: React.ReactNode
  title: string
  desc: string
  urlLabel: string
  urlPlaceholder: string
  urlHint?: string
  withTest?: boolean
}

function WebhookChannelForm(props: WebhookFormProps) {
  const { data: channels = [] } = useNotificationChannels()
  const upsert = useUpsertChannel()
  const setEnabled = useSetChannelEnabled()
  const { isMobile } = useBreakpoint()

  const existing  = channels.find(c => c.type === props.chType)
  const isEnabled = existing?.enabled ?? false

  const [url,         setUrl]         = useState('')
  const [msgDown,     setMsgDown]     = useState(DEFAULT_DOWN_MSG)
  const [msgRecovery, setMsgRecovery] = useState(DEFAULT_RECOVERY_MSG)
  const [showVars,    setShowVars]    = useState(false)
  const [saved,       setSaved]       = useState(false)

  const [testDownState,     setTestDownState]     = useState<TestState>('idle')
  const [testRecoveryState, setTestRecoveryState] = useState<TestState>('idle')
  const [testDownErr,       setTestDownErr]       = useState('')
  const [testRecoveryErr,   setTestRecoveryErr]   = useState('')

  // Sync from DB on load
  useEffect(() => {
    if (existing) {
      const cfg = existing.config
      setUrl(cfg.webhook_url ?? cfg.url ?? '')
      setMsgDown(cfg.down_message ?? DEFAULT_DOWN_MSG)
      setMsgRecovery(cfg.recovery_message ?? DEFAULT_RECOVERY_MSG)
    }
  }, [existing?.id])

  function handleToggle(v: boolean) {
    if (existing) {
      setEnabled.mutate({ id: existing.id, enabled: v })
    } else if (v) {
      handleSave(true)
    }
  }

  function handleSave(enabled = isEnabled) {
    const urlKey = props.chType === 'webhook' ? 'url' : 'webhook_url'
    upsert.mutate({
      type: props.chType,
      name: props.title,
      enabled,
      config: {
        [urlKey]:          url,
        down_message:      msgDown,
        recovery_message:  msgRecovery,
      },
    }, {
      onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2500) },
    })
  }

  async function sendToWebhook(body: string, setState: (s: TestState) => void, setErr: (e: string) => void) {
    if (!url) return
    setState('sending')
    setErr('')
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: body }),
      })
      if (res.ok) {
        setState('success')
        setTimeout(() => setState('idle'), 3000)
      } else {
        setErr(`HTTP ${res.status}`)
        setState('error')
        setTimeout(() => setState('idle'), 5000)
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Network error')
      setState('error')
      setTimeout(() => setState('idle'), 5000)
    }
  }

  function handleTestDown() {
    sendToWebhook(renderMsg(msgDown, SAMPLE_DOWN), setTestDownState, setTestDownErr)
  }

  function handleTestRecovery() {
    sendToWebhook(renderMsg(msgRecovery, SAMPLE_RECOVERY), setTestRecoveryState, setTestRecoveryErr)
  }

  return (
    <ChannelCard icon={props.icon} title={props.title} desc={props.desc} enabled={isEnabled} onToggle={handleToggle}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* URL */}
        <div>
          <label style={labelStyle}>{props.urlLabel}</label>
          <input style={inputStyle} value={url} onChange={e => setUrl(e.target.value)} placeholder={props.urlPlaceholder} />
          {props.urlHint && <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 5 }}>{props.urlHint}</div>}
          {props.chType === 'webhook' && <div style={{ marginTop: 8 }}><WebhookPayloadPreview /></div>}
        </div>

        {/* Down message */}
        <div style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-border-muted)', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: isMobile ? 'flex-start' : 'center',
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? 8 : 0,
            marginBottom: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e53e3e', flexShrink: 0 }} />
              <label style={{ ...labelStyle, marginBottom: 0, color: 'var(--color-text)' }}>Message when Down</label>
            </div>
            {props.withTest && (
              <TestButton
                label="Test Down"
                icon={<Send size={12} />}
                state={testDownState}
                error={testDownErr}
                onClick={handleTestDown}
                disabled={!url}
              />
            )}
          </div>
          <textarea style={textareaStyle} value={msgDown} onChange={e => setMsgDown(e.target.value)} />
        </div>

        {/* Recovery message */}
        <div style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-border-muted)', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: isMobile ? 'flex-start' : 'center',
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? 8 : 0,
            marginBottom: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#48bb78', flexShrink: 0 }} />
              <label style={{ ...labelStyle, marginBottom: 0, color: 'var(--color-text)' }}>Message when Recovered</label>
            </div>
            {props.withTest && (
              <TestButton
                label="Test Recovery"
                icon={<Send size={12} />}
                state={testRecoveryState}
                error={testRecoveryErr}
                onClick={handleTestRecovery}
                disabled={!url}
              />
            )}
          </div>
          <textarea style={textareaStyle} value={msgRecovery} onChange={e => setMsgRecovery(e.target.value)} />
        </div>

        <TemplateVarsHelp show={showVars} onToggle={() => setShowVars(s => !s)} />

        {/* Footer: Save */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => handleSave()}
            disabled={upsert.isPending}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: saved ? '#276749' : '#e53e3e',
              border: 'none', borderRadius: 6,
              color: '#fff', fontSize: 12, fontWeight: 500,
              padding: '7px 18px', cursor: 'pointer', transition: 'background 0.2s',
            }}
          >
            {saved ? <><Check size={12} /> Saved</> : 'Save'}
          </button>
        </div>
      </div>
    </ChannelCard>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Notifications() {
  const { isMobile } = useBreakpoint()

  return (
    <div style={{ padding: isMobile ? '16px' : '20px 24px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-text)', marginBottom: 2 }}>Notifications</h1>
        <p style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>Configure how and where you get alerted when a monitor changes status</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>

        <WebhookChannelForm
          chType="google_chat"
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 12H6l-2 2V4h16v10z" fill="#e53e3e"/>
            </svg>
          }
          title="Google Chat"
          desc="Send alerts to a Google Chat space via webhook"
          urlLabel="Webhook URL"
          urlPlaceholder="https://chat.googleapis.com/v1/spaces/.../messages?key=..."
          urlHint="Space → Apps & Integrations → Webhooks"
          withTest
        />

        <WebhookChannelForm
          chType="slack"
          icon={<Bell size={15} color="#e53e3e" />}
          title="Slack"
          desc="Post to a Slack channel via incoming webhook"
          urlLabel="Slack Webhook URL"
          urlPlaceholder="https://hooks.slack.com/services/..."
          withTest
        />

        <WebhookChannelForm
          chType="telegram"
          icon={<MessageCircle size={15} color="#e53e3e" />}
          title="Telegram"
          desc="Send alerts via Telegram bot"
          urlLabel="Bot Token"
          urlPlaceholder="123456789:ABCdef..."
          urlHint="Create a bot via @BotFather to get a token"
          withTest
        />

        <WebhookChannelForm
          chType="webhook"
          icon={<Globe size={15} color="#e53e3e" />}
          title="Webhook"
          desc="HTTP POST to a custom URL on status change"
          urlLabel="Webhook URL"
          urlPlaceholder="https://your-service.com/webhook"
          withTest
        />

      </div>
    </div>
  )
}
