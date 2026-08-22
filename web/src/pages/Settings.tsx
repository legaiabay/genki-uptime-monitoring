import { useEffect, useState } from 'react'
import { Check, User, Key, Globe, Loader2, AlertCircle } from 'lucide-react'
import Card from '@/components/ui/Card'
import {
  useProfile, useUpdateProfile, useChangePassword,
  useAppSettings, useUpdateAppSettings,
} from '@/hooks/useProfile'

type Tab = 'profile' | 'api-keys' | 'general'

const tabs: Array<{ value: Tab; label: string; icon: typeof User }> = [
  { value: 'profile',  label: 'Profile',  icon: User },
  { value: 'api-keys', label: 'API Keys', icon: Key },
  { value: 'general',  label: 'General',  icon: Globe },
]

const inputStyle = {
  width: '100%', background: '#161616', border: '1px solid #2a2a2a',
  borderRadius: 6, color: '#e8e8e8', fontSize: 13, padding: '8px 12px', outline: 'none',
} as const

const labelStyle = { fontSize: 12, color: '#888', display: 'block', marginBottom: 6 } as const

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function SaveButton({ state, onClick, label = 'Save Changes' }: { state: SaveState; onClick?: () => void; label?: string }) {
  return (
    <button onClick={onClick} disabled={state === 'saving'} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: state === 'saved' ? '#276749' : state === 'error' ? '#7B1C1C' : '#e53e3e',
      border: 'none', borderRadius: 6, color: '#fff', fontSize: 13, fontWeight: 500,
      padding: '8px 20px', cursor: state === 'saving' ? 'not-allowed' : 'pointer',
      transition: 'background 0.2s',
    }}>
      {state === 'saving' && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
      {state === 'saved'  && <Check size={13} />}
      {state === 'error'  && <AlertCircle size={13} />}
      {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : state === 'error' ? 'Failed' : label}
    </button>
  )
}

function ErrorMsg({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#fc8181', background: 'rgba(229,62,62,0.08)', border: '1px solid rgba(229,62,62,0.2)', borderRadius: 6, padding: '8px 12px' }}>
      <AlertCircle size={13} /> {msg}
    </div>
  )
}

// ── Profile tab ───────────────────────────────────────────────────────────────

function ProfileTab() {
  const { data: profile, isLoading } = useProfile()
  const updateProfile = useUpdateProfile()
  const changePassword = useChangePassword()

  const [form, setForm] = useState({ name: '', email: '' })
  const [profileState, setProfileState] = useState<SaveState>('idle')
  const [profileError, setProfileError] = useState('')

  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [pwState, setPwState] = useState<SaveState>('idle')
  const [pwError, setPwError] = useState('')

  // Sync form once profile loads
  useEffect(() => {
    if (profile) {
      setForm({ name: profile.name, email: profile.email })
    }
  }, [profile])

  function handleProfileSave() {
    setProfileError('')
    setProfileState('saving')
    updateProfile.mutate(form, {
      onSuccess: () => {
        setProfileState('saved')
        setTimeout(() => setProfileState('idle'), 2500)
      },
      onError: (err: any) => {
        setProfileError(err?.response?.data?.message ?? 'Failed to update profile')
        setProfileState('error')
        setTimeout(() => setProfileState('idle'), 4000)
      },
    })
  }

  function handlePasswordSave() {
    setPwError('')
    if (pwForm.new_password !== pwForm.confirm_password) {
      setPwError('Passwords do not match')
      return
    }
    if (pwForm.new_password.length < 8) {
      setPwError('New password must be at least 8 characters')
      return
    }
    setPwState('saving')
    changePassword.mutate(pwForm, {
      onSuccess: () => {
        setPwState('saved')
        setPwForm({ current_password: '', new_password: '', confirm_password: '' })
        setTimeout(() => setPwState('idle'), 2500)
      },
      onError: (err: any) => {
        setPwError(err?.response?.data?.message ?? 'Failed to change password')
        setPwState('error')
        setTimeout(() => setPwState('idle'), 4000)
      },
    })
  }

  if (isLoading) {
    return <div style={{ color: '#555', fontSize: 13, padding: 20 }}>Loading…</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card style={{ padding: '20px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8e8', marginBottom: 16 }}>Profile Information</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Avatar */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 4 }}>
            <div style={{ width: 52, height: 52, borderRadius: 12, background: '#e53e3e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {(form.name || profile?.name || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#e8e8e8' }}>{profile?.name}</div>
              <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{profile?.email} · {profile?.role}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Display Name</label>
              <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Email Address</label>
              <input style={inputStyle} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
          </div>

          {profileError && <ErrorMsg msg={profileError} />}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <SaveButton state={profileState} onClick={handleProfileSave} />
          </div>
        </div>
      </Card>

      <Card style={{ padding: '20px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8e8', marginBottom: 16 }}>Change Password</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Current Password</label>
            <input type="password" style={inputStyle} placeholder="••••••••"
              value={pwForm.current_password}
              onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>New Password</label>
              <input type="password" style={inputStyle} placeholder="Min. 8 characters"
                value={pwForm.new_password}
                onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Confirm Password</label>
              <input type="password" style={inputStyle} placeholder="••••••••"
                value={pwForm.confirm_password}
                onChange={e => setPwForm(f => ({ ...f, confirm_password: e.target.value }))} />
            </div>
          </div>

          {pwError && <ErrorMsg msg={pwError} />}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <SaveButton state={pwState} onClick={handlePasswordSave} label="Update Password" />
          </div>
        </div>
      </Card>
    </div>
  )
}

// ── API Keys tab ──────────────────────────────────────────────────────────────

function ApiKeysTab() {
  // TODO: wire to real API keys endpoint
  const [keys] = useState<Array<{ id: number; name: string; key: string; created: string; last_used: string }>>([])

  return (
    <Card style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8e8' }}>API Keys</div>
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#e53e3e', border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 500, padding: '6px 14px', cursor: 'pointer' }}>
          <Key size={12} /> Generate Key
        </button>
      </div>
      {keys.length === 0 ? (
        <div style={{ fontSize: 13, color: '#555', padding: '20px 0', textAlign: 'center' }}>
          No API keys yet. Generate one to get started.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Name', 'Key', 'Created', 'Last Used', ''].map(h => (
                <th key={h} style={{ padding: '8px 0', textAlign: 'left', fontSize: 11, color: '#555', fontWeight: 500, borderBottom: '1px solid #222' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keys.map((k, idx) => (
              <tr key={k.id} style={{ borderBottom: idx < keys.length - 1 ? '1px solid #1e1e1e' : 'none' }}>
                <td style={{ padding: '12px 0', fontSize: 13, color: '#e8e8e8' }}>{k.name}</td>
                <td style={{ padding: '12px 0' }}>
                  <code style={{ fontSize: 12, color: '#888', background: '#161616', padding: '3px 8px', borderRadius: 4 }}>{k.key}</code>
                </td>
                <td style={{ padding: '12px 0', fontSize: 12, color: '#555' }}>{k.created}</td>
                <td style={{ padding: '12px 0', fontSize: 12, color: '#555' }}>{k.last_used}</td>
                <td style={{ padding: '12px 0' }}>
                  <button style={{ background: 'none', border: 'none', color: '#e53e3e', fontSize: 12, cursor: 'pointer' }}>Revoke</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}

// ── General tab ───────────────────────────────────────────────────────────────

function GeneralTab() {
  const { data: settings, isLoading } = useAppSettings()
  const updateSettings = useUpdateAppSettings()

  const [form, setForm] = useState({
    site_name: '', timezone: 'Asia/Jakarta', default_interval: '60', retention_days: '90',
  })
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (settings) {
      setForm({
        site_name:        settings.site_name,
        timezone:         settings.timezone,
        default_interval: settings.default_interval,
        retention_days:   settings.retention_days,
      })
    }
  }, [settings])

  function handleSave() {
    setSaveError('')
    setSaveState('saving')
    updateSettings.mutate(form, {
      onSuccess: () => {
        setSaveState('saved')
        setTimeout(() => setSaveState('idle'), 2500)
      },
      onError: (err: any) => {
        setSaveError(err?.response?.data?.message ?? 'Failed to save settings')
        setSaveState('error')
        setTimeout(() => setSaveState('idle'), 4000)
      },
    })
  }

  if (isLoading) {
    return <div style={{ color: '#555', fontSize: 13, padding: 20 }}>Loading…</div>
  }

  return (
    <Card style={{ padding: '20px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8e8', marginBottom: 16 }}>General Settings</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={labelStyle}>Site Name</label>
            <input style={inputStyle} value={form.site_name}
              onChange={e => setForm(f => ({ ...f, site_name: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Timezone</label>
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.timezone}
              onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}>
              <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
              <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
              <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
              <option value="UTC">UTC</option>
              <option value="Europe/London">Europe/London (GMT)</option>
              <option value="America/New_York">America/New_York (EST)</option>
              <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Default Check Interval (seconds)</label>
            <input style={inputStyle} type="number" min="10" value={form.default_interval}
              onChange={e => setForm(f => ({ ...f, default_interval: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Data Retention (days)</label>
            <input style={inputStyle} type="number" min="1" value={form.retention_days}
              onChange={e => setForm(f => ({ ...f, retention_days: e.target.value }))} />
          </div>
        </div>

        {saveError && <ErrorMsg msg={saveError} />}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
          <SaveButton state={saveState} onClick={handleSave} />
        </div>
      </div>
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>('profile')

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#e8e8e8', marginBottom: 2 }}>Settings</h1>
        <p style={{ fontSize: 12, color: '#555' }}>Manage your account and preferences</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20 }}>
        {/* sidebar nav */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {tabs.map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.value
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 6, border: 'none',
                  background: active ? '#252525' : 'transparent',
                  color: active ? '#e8e8e8' : '#666',
                  fontSize: 13, fontWeight: active ? 500 : 400,
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'background 0.1s, color 0.1s',
                }}
              >
                <Icon size={14} strokeWidth={1.8} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* content */}
        <div>
          {activeTab === 'profile'  && <ProfileTab />}
          {activeTab === 'api-keys' && <ApiKeysTab />}
          {activeTab === 'general'  && <GeneralTab />}
        </div>
      </div>
    </div>
  )
}
