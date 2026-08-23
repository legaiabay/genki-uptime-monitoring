import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import logo from '@/assets/logo.png'

export default function Setup() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Setup failed')
        return
      }

      localStorage.setItem('token', data.token)
      navigate('/overview')
    } catch {
      setError('Connection error. Is the server running?')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--color-input-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    color: 'var(--color-text)',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute',
        width: 500,
        height: 500,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(229,62,62,0.06) 0%, transparent 70%)',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 420, padding: '0 20px', position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 32 }}>
          <img src={logo} alt="Genki" style={{ height: 200 }} />
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 12,
          padding: '32px 28px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>Welcome to Genki</h2>
          <p style={{ fontSize: 13, color: 'var(--color-text-dim)', marginBottom: 24 }}>Create your admin account to get started</p>

          {error && (
            <div style={{
              background: 'rgba(229,62,62,0.1)',
              border: '1px solid rgba(229,62,62,0.25)',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 12,
              color: '#fc8181',
              marginBottom: 18,
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6, fontWeight: 500 }}>
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#e53e3e'}
                onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6, fontWeight: 500 }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#e53e3e'}
                onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6, fontWeight: 500 }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#e53e3e'}
                onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6, fontWeight: 500 }}>
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#e53e3e'}
                onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: loading ? '#8B1A1A' : '#e53e3e',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                padding: '11px 0',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'background 0.2s',
              }}
            >
              {loading && <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />}
              {loading ? 'Creating account...' : 'Create admin account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
