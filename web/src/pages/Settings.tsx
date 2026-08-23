import { useEffect, useRef, useState } from 'react'
import { Check, User, Key, Globe, Loader2, AlertCircle, Copy, Trash2, Plus, CheckCheck, BookOpen, Terminal, Download, TriangleAlert, ScrollText, Wifi, WifiOff, XCircle } from 'lucide-react'
import api from '@/lib/api'
import Card from '@/components/ui/Card'
import {
  useProfile, useUpdateProfile, useChangePassword,
  useAppSettings, useUpdateAppSettings,
} from '@/hooks/useProfile'
import { useApiKeys, useCreateApiKey, useDeleteApiKey } from '@/hooks/useApiKeys'
import { useAppLogs, type LogLevel } from '@/hooks/useAppLogs'

type Tab = 'profile' | 'api-keys' | 'general' | 'logs'

const tabs: Array<{ value: Tab; label: string; icon: typeof User }> = [
  { value: 'profile',  label: 'Profile',  icon: User },
  { value: 'api-keys', label: 'API Keys', icon: Key },
  { value: 'general',  label: 'General',  icon: Globe },
  { value: 'logs',     label: 'Logs',     icon: ScrollText },
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

// ── Collection builders ───────────────────────────────────────────────────────

function downloadBlob(filename: string, content: string, mime = 'application/json') {
  const blob = new Blob([content], { type: mime })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

interface EndpointDef {
  method: string
  path: string
  desc: string
  color?: string
  body?: Record<string, unknown>
}

function buildPostmanCollection(baseUrl: string, endpointDefs: EndpointDef[]) {
  // Group requests into folders by resource prefix
  const folders: Record<string, typeof endpointDefs> = {}
  for (const ep of endpointDefs) {
    const segment = ep.path.split('/').filter(Boolean)[0] ?? 'misc'
    ;(folders[segment] ??= []).push(ep)
  }

  const makeItem = (ep: EndpointDef) => ({
    name: `${ep.method} ${ep.path}`,
    request: {
      method: ep.method,
      header: [{ key: 'Content-Type', value: 'application/json' }],
      url: {
        raw: `{{baseUrl}}${ep.path}`,
        host: ['{{baseUrl}}'],
        path: ep.path.replace(/^\//, '').split('/'),
      },
      ...(ep.body
        ? { body: { mode: 'raw', raw: JSON.stringify(ep.body, null, 2), options: { raw: { language: 'json' } } } }
        : {}),
      description: ep.desc,
    },
  })

  return {
    info: {
      name: 'Genki Uptime Monitoring',
      description: 'API collection for Genki. Set the `apiKey` variable in the environment to authenticate.',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    variable: [
      { key: 'baseUrl', value: baseUrl, type: 'string' },
      { key: 'apiKey',  value: 'gk_your_api_key_here', type: 'string' },
    ],
    auth: {
      type: 'bearer',
      bearer: [{ key: 'token', value: '{{apiKey}}', type: 'string' }],
    },
    item: Object.entries(folders).map(([name, eps]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      item: eps.map(makeItem),
    })),
  }
}

function buildBrunoCollection(baseUrl: string, endpointDefs: EndpointDef[]) {
  // Bruno's importable JSON format (OpenCollection schema)
  const folders: Record<string, typeof endpointDefs> = {}
  for (const ep of endpointDefs) {
    const segment = ep.path.split('/').filter(Boolean)[0] ?? 'misc'
    ;(folders[segment] ??= []).push(ep)
  }

  const makeReq = (ep: EndpointDef) => ({
    uid: Math.random().toString(36).slice(2),
    name: `${ep.method} ${ep.path}`,
    type: 'http',
    seq: 1,
    request: {
      method: ep.method,
      url: `{{baseUrl}}${ep.path}`,
      params: [],
      headers: [{ uid: Math.random().toString(36).slice(2), name: 'Content-Type', value: 'application/json', enabled: true }],
      auth: { mode: 'bearer', bearer: { token: '{{apiKey}}' } },
      body: ep.body
        ? { mode: 'json', json: JSON.stringify(ep.body, null, 2) }
        : { mode: 'none' },
      script: { req: '', res: '' },
      vars: { req: [], res: [] },
      assertions: [],
      tests: '',
      docs: ep.desc,
    },
  })

  return {
    version: '1',
    name: 'Genki Uptime Monitoring',
    uid: Math.random().toString(36).slice(2),
    environments: [
      {
        uid: Math.random().toString(36).slice(2),
        name: 'Default',
        variables: [
          { uid: Math.random().toString(36).slice(2), name: 'baseUrl', value: baseUrl, enabled: true, secret: false },
          { uid: Math.random().toString(36).slice(2), name: 'apiKey',  value: 'gk_your_api_key_here', enabled: true, secret: true },
        ],
      },
    ],
    items: Object.entries(folders).map(([name, eps]) => ({
      uid: Math.random().toString(36).slice(2),
      name: name.charAt(0).toUpperCase() + name.slice(1),
      type: 'folder',
      items: eps.map(makeReq),
    })),
  }
}

// ── API Keys tab ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button onClick={handleCopy} title="Copy" style={{
      background: 'none', border: 'none', cursor: 'pointer',
      color: copied ? '#68d391' : '#555', padding: '2px 4px', borderRadius: 4,
      display: 'inline-flex', alignItems: 'center',
    }}>
      {copied ? <CheckCheck size={13} /> : <Copy size={13} />}
    </button>
  )
}

function GenerateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (key: string) => void }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const createKey = useCreateApiKey()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function handleSubmit() {
    if (!name.trim()) { setError('Name is required'); return }
    setError('')
    createKey.mutate(name.trim(), {
      onSuccess: (key) => { onCreated(key.key ?? '') },
      onError: (err: any) => setError(err?.response?.data?.message ?? 'Failed to create key'),
    })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 10, padding: 24, width: 400, maxWidth: '90vw' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#e8e8e8', marginBottom: 16 }}>Generate API Key</div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Key Name</label>
          <input
            ref={inputRef}
            style={inputStyle}
            placeholder="e.g. CI/CD pipeline, monitoring script"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
        </div>
        {error && <ErrorMsg msg={error} />}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #2a2a2a', borderRadius: 6, color: '#888', fontSize: 13, padding: '7px 16px', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={createKey.isPending} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#e53e3e', border: 'none', borderRadius: 6, color: '#fff',
            fontSize: 13, fontWeight: 500, padding: '7px 16px', cursor: createKey.isPending ? 'not-allowed' : 'pointer',
          }}>
            {createKey.isPending ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={13} />}
            {createKey.isPending ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  )
}

function NewKeyModal({ rawKey, onClose }: { rawKey: string; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 10, padding: 24, width: 480, maxWidth: '90vw' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Check size={16} color="#68d391" />
          <span style={{ fontSize: 14, fontWeight: 600, color: '#e8e8e8' }}>API key generated</span>
        </div>
        <p style={{ fontSize: 12, color: '#888', marginBottom: 14, lineHeight: 1.5 }}>
          Copy your key now — it won't be shown again after you close this dialog.
        </p>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#0e0e0e', border: '1px solid #2a2a2a', borderRadius: 6, padding: '10px 12px',
        }}>
          <code style={{ flex: 1, fontSize: 12, color: '#a8d8a8', wordBreak: 'break-all' }}>{rawKey}</code>
          <CopyButton text={rawKey} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={{
            background: '#e53e3e', border: 'none', borderRadius: 6, color: '#fff',
            fontSize: 13, fontWeight: 500, padding: '7px 20px', cursor: 'pointer',
          }}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

function ApiKeysTab() {
  const { data: keys = [], isLoading } = useApiKeys()
  const deleteKey = useDeleteApiKey()

  const [showGenerate, setShowGenerate] = useState(false)
  const [newRawKey, setNewRawKey]       = useState<string | null>(null)
  const [revoking, setRevoking]         = useState<number | null>(null)

  function handleRevoke(id: number) {
    setRevoking(id)
    deleteKey.mutate(id, { onSettled: () => setRevoking(null) })
  }

  function handleCreated(key: string) {
    setShowGenerate(false)
    setNewRawKey(key)
  }

  function fmt(iso: string | null | undefined) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  // ── API endpoint reference data ────────────────────────────────────────────
  const baseUrl = window.location.origin + '/api/v1'

  const endpoints: EndpointDef[] = [
    { method: 'GET',    color: '#63b3ed', path: '/monitors',            desc: 'List all monitors' },
    { method: 'POST',   color: '#68d391', path: '/monitors',            desc: 'Create a monitor',
      body: { name: 'My Site', url: 'https://example.com', type: 'http', interval: 60, timeout: 30, expected_status: 200 } },
    { method: 'GET',    color: '#63b3ed', path: '/monitors/:id',        desc: 'Get a single monitor' },
    { method: 'PUT',    color: '#f6ad55', path: '/monitors/:id',        desc: 'Update a monitor',
      body: { name: 'My Site', url: 'https://example.com', interval: 60 } },
    { method: 'DELETE', color: '#fc8181', path: '/monitors/:id',        desc: 'Delete a monitor' },
    { method: 'GET',    color: '#63b3ed', path: '/monitors/:id/logs',   desc: 'Get check history' },
    { method: 'GET',    color: '#63b3ed', path: '/incidents',           desc: 'List incidents' },
    { method: 'GET',    color: '#63b3ed', path: '/incidents/:id',       desc: 'Get an incident' },
    { method: 'PUT',    color: '#f6ad55', path: '/incidents/:id',       desc: 'Update an incident',
      body: { title: 'Outage', description: 'Service is down', status: 'investigating' } },
    { method: 'GET',    color: '#63b3ed', path: '/heartbeats',          desc: 'List heartbeat monitors' },
    { method: 'GET',    color: '#63b3ed', path: '/stats/overview',      desc: 'Dashboard overview stats' },
    { method: 'GET',    color: '#63b3ed', path: '/stats/uptime-series', desc: 'Uptime time-series (?range=1h|6h|24h|7d|30d)' },
    { method: 'GET',    color: '#63b3ed', path: '/notifications',       desc: 'List notification channels' },
    { method: 'POST',   color: '#68d391', path: '/notifications',       desc: 'Create/update a channel',
      body: { type: 'slack', name: 'Slack', enabled: true, config: { webhook_url: 'https://hooks.slack.com/…' } } },
    { method: 'DELETE', color: '#fc8181', path: '/notifications/:id',   desc: 'Remove a channel' },
    { method: 'GET',    color: '#63b3ed', path: '/logs',                desc: 'App log snapshot (ring buffer, last 500 entries)' },
    { method: 'GET',    color: '#63b3ed', path: '/settings/show-url',   desc: 'Get show-URL-on-public-page setting' },
    { method: 'PATCH',  color: '#f6ad55', path: '/settings/show-url',   desc: 'Toggle show-URL-on-public-page setting',
      body: { show_url: true } },
    { method: 'GET',    color: '#63b3ed', path: '/profile',             desc: 'Get your profile' },
    { method: 'PUT',    color: '#f6ad55', path: '/profile',             desc: 'Update your profile',
      body: { name: 'Jane Doe', email: 'jane@example.com' } },
    { method: 'GET',    color: '#63b3ed', path: '/api-keys',            desc: 'List API keys' },
    { method: 'POST',   color: '#68d391', path: '/api-keys',            desc: 'Generate an API key',
      body: { name: 'CI pipeline' } },
    { method: 'DELETE', color: '#fc8181', path: '/api-keys/:id',        desc: 'Revoke an API key' },
  ]

  const curlExample = `curl -s \\
  -H "Authorization: Bearer gk_your_api_key_here" \\
  ${baseUrl}/monitors`

  const jsExample = `const res = await fetch('${baseUrl}/monitors', {
  headers: { 'Authorization': 'Bearer gk_your_api_key_here' }
})
const { data } = await res.json()`

  const pyExample = `import requests
r = requests.get(
    '${baseUrl}/monitors',
    headers={'Authorization': 'Bearer gk_your_api_key_here'}
)
monitors = r.json()['data']`

  const goExample = `package main

import (
  "encoding/json"
  "fmt"
  "net/http"
)

func main() {
  req, _ := http.NewRequest("GET", "${baseUrl}/monitors", nil)
  req.Header.Set("Authorization", "Bearer gk_your_api_key_here")

  resp, _ := http.DefaultClient.Do(req)
  defer resp.Body.Close()

  var result map[string]any
  json.NewDecoder(resp.Body).Decode(&result)
  fmt.Println(result["data"])
}`

  const phpExample = `<?php
$ch = curl_init('${baseUrl}/monitors');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => [
        'Authorization: Bearer gk_your_api_key_here',
    ],
]);
$body = curl_exec($ch);
curl_close($ch);

$monitors = json_decode($body, true)['data'];`

  const rubyExample = `require 'net/http'
require 'json'

uri  = URI('${baseUrl}/monitors')
req  = Net::HTTP::Get.new(uri)
req['Authorization'] = 'Bearer gk_your_api_key_here'

res      = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == 'https') { |h| h.request(req) }
monitors = JSON.parse(res.body)['data']`

  const javaExample = `import java.net.URI;
import java.net.http.*;

public class Main {
    public static void main(String[] args) throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("${baseUrl}/monitors"))
            .header("Authorization", "Bearer gk_your_api_key_here")
            .build();

        HttpResponse<String> response =
            client.send(request, HttpResponse.BodyHandlers.ofString());
        System.out.println(response.body());
    }
}`

  const [codeTab, setCodeTab] = useState<'curl' | 'js' | 'python' | 'go' | 'php' | 'ruby' | 'java'>('curl')
  const codeMap = { curl: curlExample, js: jsExample, python: pyExample, go: goExample, php: phpExample, ruby: rubyExample, java: javaExample }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Keys table card ── */}
      <Card style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8e8' }}>API Keys</div>
            <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>
              Keys authenticate API requests in place of your session token.
            </div>
          </div>
          <button
            onClick={() => setShowGenerate(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#e53e3e', border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 500, padding: '7px 14px', cursor: 'pointer' }}
          >
            <Plus size={13} /> Generate Key
          </button>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#555', fontSize: 13, padding: '16px 0' }}>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
          </div>
        ) : keys.length === 0 ? (
          <div style={{ fontSize: 13, color: '#555', padding: '24px 0', textAlign: 'center' }}>
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
                <tr key={k.id} style={{ borderBottom: idx < keys.length - 1 ? '1px solid #1a1a1a' : 'none' }}>
                  <td style={{ padding: '11px 0', fontSize: 13, color: '#e8e8e8', paddingRight: 12 }}>{k.name}</td>
                  <td style={{ padding: '11px 0', paddingRight: 12 }}>
                    <code style={{ fontSize: 12, color: '#888', background: '#161616', padding: '3px 8px', borderRadius: 4 }}>
                      {k.key_prefix}
                    </code>
                  </td>
                  <td style={{ padding: '11px 0', fontSize: 12, color: '#555', paddingRight: 12, whiteSpace: 'nowrap' }}>{fmt(k.created_at)}</td>
                  <td style={{ padding: '11px 0', fontSize: 12, color: '#555', paddingRight: 12, whiteSpace: 'nowrap' }}>{fmt(k.last_used)}</td>
                  <td style={{ padding: '11px 0', textAlign: 'right' }}>
                    <button
                      onClick={() => handleRevoke(k.id)}
                      disabled={revoking === k.id}
                      title="Revoke key"
                      style={{ background: 'none', border: 'none', color: '#555', cursor: revoking === k.id ? 'not-allowed' : 'pointer', padding: '2px 4px', borderRadius: 4, display: 'inline-flex', alignItems: 'center' }}
                    >
                      {revoking === k.id
                        ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                        : <Trash2 size={14} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* ── Download Collections card ── */}
      <Card style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Download size={14} color="#e53e3e" />
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8e8' }}>Download Collections</div>
        </div>
        <p style={{ fontSize: 12, color: '#555', marginBottom: 20, lineHeight: 1.6 }}>
          Import this collection into your API client to start testing immediately.
          The collection includes all endpoints pre-configured with Bearer token auth —
          just replace <code style={{ color: '#888', background: '#161616', padding: '1px 6px', borderRadius: 3, fontSize: 11 }}>apiKey</code> with your key in the environment.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* Postman */}
          <div style={{ background: '#0e0e0e', border: '1px solid #1e1e1e', borderRadius: 8, padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              {/* Postman orange "P" logo mark */}
              <div style={{
                width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                background: '#FF6C37', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 13, color: '#fff', fontFamily: 'serif',
              }}>P</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8e8' }}>Postman</div>
                <div style={{ fontSize: 11, color: '#555' }}>Collection v2.1</div>
              </div>
            </div>
            <p style={{ fontSize: 12, color: '#666', marginBottom: 14, lineHeight: 1.5 }}>
              Import into Postman via <em>File → Import</em>. An environment with <code style={{ fontSize: 11 }}>baseUrl</code> and <code style={{ fontSize: 11 }}>apiKey</code> is bundled inside the file.
            </p>
            <button
              onClick={() => {
                const col = buildPostmanCollection(baseUrl, endpoints)
                downloadBlob('genki-postman-collection.json', JSON.stringify(col, null, 2))
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'center',
                background: '#FF6C3720', border: '1px solid #FF6C3740', borderRadius: 6,
                color: '#FF6C37', fontSize: 12, fontWeight: 500, padding: '8px 0', cursor: 'pointer',
              }}
            >
              <Download size={13} /> Download for Postman
            </button>
          </div>

          {/* Bruno */}
          <div style={{ background: '#0e0e0e', border: '1px solid #1e1e1e', borderRadius: 8, padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              {/* Bruno golden "B" logo mark */}
              <div style={{
                width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                background: '#c9a227', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 13, color: '#fff', fontFamily: 'serif',
              }}>B</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8e8' }}>Bruno</div>
                <div style={{ fontSize: 11, color: '#555' }}>OpenCollection format</div>
              </div>
            </div>
            <p style={{ fontSize: 12, color: '#666', marginBottom: 14, lineHeight: 1.5 }}>
              Import into Bruno via <em>+ → Import Collection</em>. Contains a Default environment with <code style={{ fontSize: 11 }}>baseUrl</code> and <code style={{ fontSize: 11 }}>apiKey</code>.
            </p>
            <button
              onClick={() => {
                const col = buildBrunoCollection(baseUrl, endpoints)
                downloadBlob('genki-bruno-collection.json', JSON.stringify(col, null, 2))
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'center',
                background: '#c9a22720', border: '1px solid #c9a22740', borderRadius: 6,
                color: '#c9a227', fontSize: 12, fontWeight: 500, padding: '8px 0', cursor: 'pointer',
              }}
            >
              <Download size={13} /> Download for Bruno
            </button>
          </div>
        </div>
      </Card>

      {/* ── API Reference card ── */}
      <Card style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <BookOpen size={14} color="#e53e3e" />
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8e8' }}>API Reference</div>
        </div>
        <p style={{ fontSize: 12, color: '#555', marginBottom: 20, lineHeight: 1.6 }}>
          All protected endpoints accept either a session JWT or an API key as a Bearer token.
          The base URL is <code style={{ color: '#888', background: '#161616', padding: '1px 6px', borderRadius: 3, fontSize: 11 }}>{baseUrl}</code>.
        </p>

        {/* Authentication snippet */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Terminal size={13} color="#888" />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Authentication</span>
          </div>
          <div style={{ background: '#0e0e0e', border: '1px solid #222', borderRadius: 8, overflow: 'hidden' }}>
            {/* tab bar */}
            <div style={{ display: 'flex', borderBottom: '1px solid #1e1e1e', flexWrap: 'wrap' }}>
              {(['curl', 'js', 'python', 'go', 'php', 'ruby', 'java'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setCodeTab(t)}
                  style={{
                    background: codeTab === t ? '#161616' : 'none',
                    border: 'none', borderRight: '1px solid #1e1e1e',
                    color: codeTab === t ? '#e8e8e8' : '#555',
                    fontSize: 11, padding: '7px 14px', cursor: 'pointer',
                    fontWeight: codeTab === t ? 500 : 400,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t === 'js' ? 'JavaScript' : t === 'python' ? 'Python' : t === 'go' ? 'Go' : t === 'php' ? 'PHP' : t === 'ruby' ? 'Ruby' : t === 'java' ? 'Java' : 'cURL'}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              <CopyButton text={codeMap[codeTab]} />
            </div>
            <pre style={{ margin: 0, padding: '14px 16px', fontSize: 12, color: '#a8d8a8', overflowX: 'auto', lineHeight: 1.6 }}>
              <code>{codeMap[codeTab]}</code>
            </pre>
          </div>
        </div>

        {/* Endpoints table */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Available Endpoints
          </div>
          <div style={{ border: '1px solid #1e1e1e', borderRadius: 8, overflow: 'hidden' }}>
            {endpoints.map((ep, idx) => (
              <div
                key={idx}
                style={{
                  display: 'grid', gridTemplateColumns: '64px 1fr auto',
                  alignItems: 'center', gap: 12, padding: '9px 14px',
                  borderBottom: idx < endpoints.length - 1 ? '1px solid #161616' : 'none',
                  background: idx % 2 === 0 ? 'transparent' : '#0e0e0e',
                }}
              >
                <span style={{
                  fontSize: 10, fontWeight: 700, color: ep.color,
                  background: ep.color + '18', padding: '2px 6px', borderRadius: 3,
                  textAlign: 'center', letterSpacing: '0.04em',
                }}>
                  {ep.method}
                </span>
                <code style={{ fontSize: 12, color: '#888' }}>{ep.path}</code>
                <span style={{ fontSize: 12, color: '#555', textAlign: 'right' }}>{ep.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* modals */}
      {showGenerate && <GenerateModal onClose={() => setShowGenerate(false)} onCreated={handleCreated} />}
      {newRawKey    && <NewKeyModal rawKey={newRawKey} onClose={() => setNewRawKey(null)} />}
    </div>
  )
}

// ── Reset confirm modal ───────────────────────────────────────────────────────

type ResetScope = 'monitoring' | 'all'

const RESET_CONFIG: Record<ResetScope, {
  title: string
  description: React.ReactNode
  confirmLabel: string
  confirmWord: string
}> = {
  monitoring: {
    title: 'Reset Monitoring Data',
    description: (
      <>
        This will <strong style={{ color: '#fc8181' }}>permanently delete</strong> all monitors,
        check logs, incidents, and heartbeats. Users, API keys, notification channels, and settings
        will be preserved. You will stay logged in.
        <br /><br />
        This action <strong style={{ color: '#fc8181' }}>cannot be undone</strong>.
      </>
    ),
    confirmLabel: 'Reset Monitoring Data',
    confirmWord: 'RESET',
  },
  all: {
    title: 'Reset All Data',
    description: (
      <>
        This will <strong style={{ color: '#fc8181' }}>permanently delete</strong> all monitors,
        incidents, heartbeats, API keys, notification channels, settings, and users. The app will
        return to first-boot state and you will be logged out.
        <br /><br />
        This action <strong style={{ color: '#fc8181' }}>cannot be undone</strong>.
      </>
    ),
    confirmLabel: 'Reset Everything',
    confirmWord: 'RESET ALL',
  },
}

function ResetConfirmModal({ scope, onClose, onConfirm, busy }: {
  scope: ResetScope
  onClose: () => void
  onConfirm: () => void
  busy: boolean
}) {
  const [typed, setTyped] = useState('')
  const cfg = RESET_CONFIG[scope]
  const match = typed === cfg.confirmWord

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={e => { if (!busy && e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#1a1a1a', border: '1px solid #3a1a1a', borderRadius: 10, padding: 24, width: 460, maxWidth: '90vw' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(229,62,62,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <TriangleAlert size={16} color="#e53e3e" />
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e8e8e8' }}>{cfg.title}</div>
        </div>

        <p style={{ fontSize: 13, color: '#888', lineHeight: 1.6, marginBottom: 16 }}>
          {cfg.description}
        </p>

        <div style={{ marginBottom: 16 }}>
          <label style={{ ...labelStyle, marginBottom: 8 }}>
            Type <code style={{ color: '#fc8181', background: '#2a1010', padding: '1px 6px', borderRadius: 3 }}>{cfg.confirmWord}</code> to confirm
          </label>
          <input
            autoFocus
            style={{ ...inputStyle, borderColor: match ? '#e53e3e' : '#2a2a2a' }}
            placeholder={cfg.confirmWord}
            value={typed}
            onChange={e => setTyped(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && match && !busy && onConfirm()}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            disabled={busy}
            style={{ background: 'none', border: '1px solid #2a2a2a', borderRadius: 6, color: '#888', fontSize: 13, padding: '7px 16px', cursor: busy ? 'not-allowed' : 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!match || busy}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: match && !busy ? '#e53e3e' : '#5a2020',
              border: 'none', borderRadius: 6,
              color: match ? '#fff' : '#7a4040',
              fontSize: 13, fontWeight: 500, padding: '7px 16px',
              cursor: !match || busy ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s, color 0.2s',
            }}
          >
            {busy
              ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Resetting…</>
              : <><Trash2 size={13} /> {cfg.confirmLabel}</>}
          </button>
        </div>
      </div>
    </div>
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

  const [showResetModal, setShowResetModal] = useState<ResetScope | null>(null)
  const [resetBusy, setResetBusy] = useState(false)
  const [resetError, setResetError] = useState('')

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

  async function handleReset() {
    if (!showResetModal) return
    setResetBusy(true)
    setResetError('')
    try {
      if (showResetModal === 'monitoring') {
        await api.post('/settings/reset-monitoring')
        setShowResetModal(null)
        setResetBusy(false)
      } else {
        await api.post('/settings/reset-data')
        localStorage.removeItem('token')
        window.location.href = '/register'
      }
    } catch (err: any) {
      setResetError(err?.response?.data?.message ?? 'Reset failed')
      setResetBusy(false)
    }
  }

  if (isLoading) {
    return <div style={{ color: '#555', fontSize: 13, padding: 20 }}>Loading…</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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

      {/* ── Danger Zone ── */}
      <Card style={{ padding: '20px', border: '1px solid #3a1a1a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <TriangleAlert size={14} color="#e53e3e" />
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e53e3e' }}>Danger Zone</div>
        </div>
        <p style={{ fontSize: 12, color: '#666', marginBottom: 16, lineHeight: 1.6 }}>
          Destructive actions that cannot be reversed. Proceed with extreme caution.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Row 1 — monitoring data only */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#160a0a', border: '1px solid #2a1212', borderRadius: 8 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#e8e8e8', marginBottom: 3 }}>Reset Monitoring Data</div>
              <div style={{ fontSize: 12, color: '#666' }}>Delete all monitors, logs, incidents, and heartbeats. Users and settings are preserved.</div>
            </div>
            <button
              onClick={() => { setResetError(''); setShowResetModal('monitoring') }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 16,
                background: 'transparent', border: '1px solid #555', borderRadius: 6,
                color: '#aaa', fontSize: 12, fontWeight: 500, padding: '7px 14px', cursor: 'pointer',
              }}
            >
              <Trash2 size={13} /> Reset Monitoring
            </button>
          </div>

          {/* Row 2 — everything including users */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#160a0a', border: '1px solid #2a1212', borderRadius: 8 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#e8e8e8', marginBottom: 3 }}>Reset All Data</div>
              <div style={{ fontSize: 12, color: '#666' }}>Delete everything including users and settings. App returns to first-boot state, you will be logged out.</div>
            </div>
            <button
              onClick={() => { setResetError(''); setShowResetModal('all') }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 16,
                background: 'transparent', border: '1px solid #e53e3e', borderRadius: 6,
                color: '#e53e3e', fontSize: 12, fontWeight: 500, padding: '7px 14px', cursor: 'pointer',
              }}
            >
              <Trash2 size={13} /> Reset Everything
            </button>
          </div>
        </div>

        {resetError && <div style={{ marginTop: 10 }}><ErrorMsg msg={resetError} /></div>}
      </Card>

      {showResetModal && (
        <ResetConfirmModal
          scope={showResetModal}
          busy={resetBusy}
          onClose={() => setShowResetModal(null)}
          onConfirm={handleReset}
        />
      )}
    </div>
  )
}

// ── Logs tab ──────────────────────────────────────────────────────────────────

const LEVEL_COLOR: Record<LogLevel, string> = {
  info:  '#63b3ed',
  warn:  '#f6ad55',
  error: '#fc8181',
  debug: '#a0aec0',
}

function LogsTab() {
  const { entries, isLoading, clear, wsRef } = useAppLogs()
  const [filter, setFilter] = useState<LogLevel | 'all'>('all')
  const [search, setSearch] = useState('')
  const [paused, setPaused] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Track WebSocket connectivity for the status indicator.
  useEffect(() => {
    const interval = setInterval(() => {
      setWsConnected(wsRef.current?.readyState === WebSocket.OPEN)
    }, 1000)
    return () => clearInterval(interval)
  }, [wsRef])

  // Auto-scroll to bottom when new entries arrive (unless paused).
  useEffect(() => {
    if (!paused) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [entries, paused])

  const visible = entries.filter(e => {
    if (filter !== 'all' && e.level !== filter) return false
    if (search && !e.message.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function fmt(ts: string) {
    const d = new Date(ts)
    return d.toLocaleTimeString('en-GB', { hour12: false }) + '.' +
      String(d.getMilliseconds()).padStart(3, '0')
  }

  function downloadLogs() {
    const text = entries.map(e => `[${new Date(e.timestamp).toISOString()}] [${e.level.toUpperCase()}] ${e.message}`).join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement('a'), { href: url, download: 'genki-app-logs.txt' })
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card style={{ padding: '16px 20px' }}>
        {/* ── Toolbar ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {/* WS status badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: wsConnected ? '#68d391' : '#fc8181', background: wsConnected ? 'rgba(104,211,145,0.08)' : 'rgba(252,129,129,0.08)', border: `1px solid ${wsConnected ? 'rgba(104,211,145,0.2)' : 'rgba(252,129,129,0.2)'}`, borderRadius: 5, padding: '3px 8px' }}>
            {wsConnected ? <Wifi size={11} /> : <WifiOff size={11} />}
            {wsConnected ? 'Live' : 'Disconnected'}
          </div>

          {/* Entry count */}
          <span style={{ fontSize: 11, color: '#555' }}>{visible.length} / {entries.length} entries</span>

          <div style={{ flex: 1 }} />

          {/* Search */}
          <input
            style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 6, color: '#e8e8e8', fontSize: 12, padding: '5px 10px', width: 180, outline: 'none' }}
            placeholder="Search messages…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          {/* Level filter */}
          {/* Level filter — wrapper needed to position custom arrow */}
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <select
              style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 6, color: '#e8e8e8', fontSize: 12, padding: '5px 32px 5px 10px', outline: 'none', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' }}
              value={filter}
              onChange={e => setFilter(e.target.value as LogLevel | 'all')}
            >
              <option value="all">All levels</option>
              <option value="info">Info</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
              <option value="debug">Debug</option>
            </select>
            <svg style={{ position: 'absolute', right: 9, pointerEvents: 'none', color: '#666' }} width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          {/* Pause / resume */}
          <button
            onClick={() => setPaused(p => !p)}
            title={paused ? 'Resume auto-scroll' : 'Pause auto-scroll'}
            style={{ background: paused ? 'rgba(246,173,85,0.12)' : '#161616', border: `1px solid ${paused ? 'rgba(246,173,85,0.3)' : '#2a2a2a'}`, borderRadius: 6, color: paused ? '#f6ad55' : '#555', fontSize: 12, padding: '5px 10px', cursor: 'pointer' }}
          >
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>

          {/* Download */}
          <button
            onClick={downloadLogs}
            title="Download logs as .txt"
            style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 6, color: '#555', padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <Download size={13} />
          </button>

          {/* Clear */}
          <button
            onClick={clear}
            title="Clear log view"
            style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 6, color: '#555', padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <XCircle size={13} />
          </button>
        </div>

        {/* ── Log output ── */}
        <div
          ref={containerRef}
          style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: 8, height: 480, overflowY: 'auto', fontFamily: 'monospace', fontSize: 12 }}
        >
          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#555', padding: 16 }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
            </div>
          ) : visible.length === 0 ? (
            <div style={{ color: '#333', padding: 16 }}>No log entries{search || filter !== 'all' ? ' matching filters' : ''}.</div>
          ) : (
            visible.map((e, i) => (
              <div
                key={i}
                style={{ display: 'flex', gap: 10, padding: '3px 12px', borderBottom: '1px solid #111', alignItems: 'flex-start' }}
              >
                <span style={{ color: '#555', flexShrink: 0, userSelect: 'none', paddingTop: 1 }}>{fmt(e.timestamp)}</span>
                <span style={{ color: LEVEL_COLOR[e.level], flexShrink: 0, width: 40, textTransform: 'uppercase', fontSize: 10, fontWeight: 700, paddingTop: 2 }}>{e.level}</span>
                <span style={{ color: '#c8c8c8', wordBreak: 'break-word', lineHeight: 1.5 }}>{e.message}</span>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </Card>
    </div>
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
          {activeTab === 'logs'     && <LogsTab />}
        </div>
      </div>
    </div>
  )
}
