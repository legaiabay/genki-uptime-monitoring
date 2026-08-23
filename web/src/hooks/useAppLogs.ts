import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
}

// ── REST snapshot (initial load) ──────────────────────────────────────────────

async function fetchLogSnapshot(): Promise<LogEntry[]> {
  const res = await api.get<{ data: LogEntry[] }>('/logs')
  return res.data.data ?? []
}

// ── Hook ──────────────────────────────────────────────────────────────────────

const MAX_ENTRIES = 500

/**
 * useAppLogs
 *
 * 1. Fetches the current ring-buffer snapshot via REST on mount.
 * 2. Opens a WebSocket connection and appends live `log` events in real time.
 * 3. Caps the local list at MAX_ENTRIES to avoid unbounded memory growth.
 */
export function useAppLogs() {
  const { data: snapshot, isLoading } = useQuery<LogEntry[]>({
    queryKey: ['app-logs-snapshot'],
    queryFn: fetchLogSnapshot,
    // Only fetch once; live updates arrive via WebSocket.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  const [liveEntries, setLiveEntries] = useState<LogEntry[]>([])
  const wsRef = useRef<WebSocket | null>(null)

  // Initialise live list from snapshot when it arrives.
  useEffect(() => {
    if (snapshot) {
      setLiveEntries(snapshot)
    }
  }, [snapshot])

  // Open WebSocket and stream log events.
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const wsUrl = `${proto}://${window.location.host}/api/v1/ws?token=${encodeURIComponent(token)}`

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      // Send auth token as first message so the server can validate if needed.
      ws.send(JSON.stringify({ type: 'auth', token }))
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as { type: string; payload: unknown }
        if (msg.type !== 'log') return
        const entry = msg.payload as LogEntry
        setLiveEntries(prev => {
          const next = [...prev, entry]
          return next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next
        })
      } catch {
        // Ignore malformed frames.
      }
    }

    ws.onerror = () => {
      // Silent — the component shows a "disconnected" state based on ws.readyState.
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [])

  // Expose a manual clear so the user can wipe the local view.
  function clear() {
    setLiveEntries([])
  }

  return {
    entries: liveEntries,
    isLoading,
    clear,
    wsRef,
  }
}
