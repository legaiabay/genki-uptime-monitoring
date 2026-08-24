import { useState } from 'react'
import api from '@/lib/api'

export interface ImportResult {
  monitors_created: number
  monitors_skipped: number
  logs_imported: number
  incidents_created: number
}

// Triggers a file download of the backup JSON from the server.
export function useExportBackup() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function exportBackup() {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get('/backup/export', { responseType: 'blob' })
      const disposition: string = res.headers['content-disposition'] ?? ''
      const match = disposition.match(/filename="?([^"]+)"?/)
      const filename = match ? match[1] : `genki-backup-${new Date().toISOString().slice(0, 10)}.json`

      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setLoading(false)
    }
  }

  return { exportBackup, loading, error }
}

// Sends a JSON or ZIP backup file to the import endpoint and returns the result summary.
export function useImportBackup() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  async function importBackup(file: File): Promise<ImportResult | null> {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      let body: string | ArrayBuffer

      if (file.name.endsWith('.zip')) {
        // Send raw binary so the server can unzip it
        body = await file.arrayBuffer()
        const res = await api.post<{ data: ImportResult }>('/backup/import', body, {
          headers: { 'Content-Type': 'application/zip' },
        })
        setResult(res.data.data)
        return res.data.data
      } else {
        // Parse JSON client-side first for early validation
        const text = await file.text()
        let parsed: unknown
        try {
          parsed = JSON.parse(text)
        } catch {
          throw new Error('File is not valid JSON')
        }
        const res = await api.post<{ data: ImportResult }>('/backup/import', parsed)
        setResult(res.data.data)
        return res.data.data
      }
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (e instanceof Error ? e.message : 'Import failed')
      setError(msg)
      return null
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setError(null)
    setResult(null)
  }

  return { importBackup, loading, error, result, reset }
}
