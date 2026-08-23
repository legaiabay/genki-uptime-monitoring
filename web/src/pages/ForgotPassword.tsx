import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, CheckCircle2 } from 'lucide-react'
import logo from '@/assets/logo.png'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [resetSecret, setResetSecret] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset_secret: resetSecret, new_password: newPassword }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Reset failed')
        return
      }

      setSuccess(true)
    } catch {
      setError('Connection error. Is the server running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '90vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0d0d0d',
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

      <div style={{ width: '100%', maxWidth: 400, padding: '0 20px', position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 32 }}>
          <img src={logo} alt="Genki" style={{ height: 200 }} />
        </div>

        {/* Card */}
        <div style={{
          background: '#161616',
          border: '1px solid #252525',
          borderRadius: 12,
          padding: '32px 28px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}>
          {success ? (
            <div style={{ textAlign: 'center' }}>
              <CheckCircle2 size={40} style={{ margin: '0 auto 16px', display: 'block' }} color="#48bb78" />
              <h2 style={{ fontSize: 18, fontWeight: 600, color: '#e8e8e8', marginBottom: 8 }}>Password reset</h2>
              <p style={{ fontSize: 13, color: '#555', marginBottom: 24 }}>
                Your password has been updated successfully.
              </p>
              <button
                onClick={() => navigate('/login')}
                style={{
                  width: '100%',
                  background: '#e53e3e',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  padding: '11px 0',
                  cursor: 'pointer',
                }}
              >
                Back to login
              </button>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: '#e8e8e8', marginBottom: 4 }}>Reset password</h2>
              <p style={{ fontSize: 13, color: '#555', marginBottom: 24 }}>
                Enter the reset secret from your server config and your new password.
              </p>

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
                  <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6, fontWeight: 500 }}>
                    Reset Secret
                  </label>
                  <input
                    type="password"
                    value={resetSecret}
                    onChange={(e) => setResetSecret(e.target.value)}
                    placeholder="Value of RESET_SECRET in your .env"
                    required
                    style={{
                      width: '100%',
                      background: '#111',
                      border: '1px solid #2a2a2a',
                      borderRadius: 8,
                      padding: '10px 14px',
                      fontSize: 13,
                      color: '#e8e8e8',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={e => e.target.style.borderColor = '#e53e3e'}
                    onBlur={e => e.target.style.borderColor = '#2a2a2a'}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6, fontWeight: 500 }}>
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    style={{
                      width: '100%',
                      background: '#111',
                      border: '1px solid #2a2a2a',
                      borderRadius: 8,
                      padding: '10px 14px',
                      fontSize: 13,
                      color: '#e8e8e8',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={e => e.target.style.borderColor = '#e53e3e'}
                    onBlur={e => e.target.style.borderColor = '#2a2a2a'}
                  />
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6, fontWeight: 500 }}>
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    style={{
                      width: '100%',
                      background: '#111',
                      border: '1px solid #2a2a2a',
                      borderRadius: 8,
                      padding: '10px 14px',
                      fontSize: 13,
                      color: '#e8e8e8',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={e => e.target.style.borderColor = '#e53e3e'}
                    onBlur={e => e.target.style.borderColor = '#2a2a2a'}
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
                    marginBottom: 16,
                  }}
                >
                  {loading && <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />}
                  {loading ? 'Resetting...' : 'Reset password'}
                </button>

                <div style={{ textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: 12,
                      color: '#555',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Back to login
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
