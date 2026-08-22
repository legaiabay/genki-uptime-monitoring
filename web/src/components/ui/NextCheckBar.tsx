import { useEffect, useState } from 'react'

interface Props {
  lastCheckedAt: string | null
  intervalSeconds: number
}

export default function NextCheckBar({ lastCheckedAt, intervalSeconds }: Props) {
  const [progress, setProgress] = useState(0) // 0–100, percentage toward next check
  const [secondsLeft, setSecondsLeft] = useState(0)

  useEffect(() => {
    function compute() {
      if (!lastCheckedAt) {
        setProgress(0)
        setSecondsLeft(0)
        return
      }
      const elapsed = (Date.now() - new Date(lastCheckedAt).getTime()) / 1000
      const pct = Math.min((elapsed / intervalSeconds) * 100, 100)
      const left = Math.max(0, Math.ceil(intervalSeconds - elapsed))
      setProgress(pct)
      setSecondsLeft(left)
    }

    compute()
    const id = setInterval(compute, 1000)
    return () => clearInterval(id)
  }, [lastCheckedAt, intervalSeconds])

  const label = secondsLeft <= 0 ? 'Checking…' : `Next check in ${secondsLeft}s`
  const barColor = secondsLeft <= 0 ? '#e53e3e' : '#333'
  const fillColor = secondsLeft <= 0 ? '#e53e3e' : '#48bb78'

  return (
    <div style={{ minWidth: 110 }}>
      {/* progress bar */}
      <div style={{
        height: 3, borderRadius: 2, background: barColor,
        overflow: 'hidden', marginBottom: 3,
      }}>
        <div style={{
          height: '100%', width: `${progress}%`,
          background: fillColor,
          transition: 'width 1s linear, background 0.3s',
          borderRadius: 2,
        }} />
      </div>
      <div style={{ fontSize: 10, color: secondsLeft <= 0 ? '#fc8181' : '#444', whiteSpace: 'nowrap' }}>
        {lastCheckedAt ? label : '—'}
      </div>
    </div>
  )
}
