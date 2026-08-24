import { useRef, useState, type DragEvent } from 'react'
import { Download, Upload, CheckCircle, AlertCircle, Loader2, FileJson } from 'lucide-react'
import Card from '@/components/ui/Card'
import { useExportBackup, useImportBackup, type ImportResult } from '@/hooks/useBackup'

const sectionTitleStyle = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--color-text)',
  marginBottom: 4,
} as const

const descStyle = {
  fontSize: 12,
  color: 'var(--color-text-muted)',
  marginBottom: 16,
  lineHeight: 1.6,
} as const

const btnBase = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  border: 'none',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 500,
  padding: '8px 18px',
  cursor: 'pointer',
  transition: 'opacity 0.15s',
} as const

function ExportSection() {
  const { exportBackup, loading, error } = useExportBackup()

  return (
    <Card style={{ padding: 20 }}>
      <div style={sectionTitleStyle}>Export Backup</div>
      <p style={descStyle}>
        Download all monitor data, check history (based on data retention settings), and
        incidents into a compressed <strong style={{ color: 'var(--color-text)' }}>.zip</strong> file
        containing a single JSON. This file can be used to restore or migrate to another Genki instance.
      </p>

      <button
        onClick={exportBackup}
        disabled={loading}
        style={{
          ...btnBase,
          background: loading ? 'var(--color-surface-hover)' : '#e53e3e',
          color: '#fff',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading
          ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
          : <Download size={13} />}
        {loading ? 'Exporting…' : 'Download Backup'}
      </button>

      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: '#fc8181',
          background: 'rgba(229,62,62,0.08)',
          border: '1px solid rgba(229,62,62,0.2)',
          borderRadius: 6, padding: '8px 12px', marginTop: 12,
        }}>
          <AlertCircle size={13} /> {error}
        </div>
      )}
    </Card>
  )
}

function ImportSection() {
  const { importBackup, loading, error, result, reset } = useImportBackup()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  function handleFile(file: File) {
    if (!file.name.endsWith('.json') && !file.name.endsWith('.zip')) {
      return
    }
    setSelectedFile(file)
    setConfirmed(false)
    reset()
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  async function handleImport() {
    if (!selectedFile) return
    const res = await importBackup(selectedFile)
    if (res) {
      setSelectedFile(null)
      setConfirmed(false)
    }
  }

  function handleClear() {
    setSelectedFile(null)
    setConfirmed(false)
    reset()
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <Card style={{ padding: 20 }}>
      <div style={sectionTitleStyle}>Restore / Import</div>
      <p style={descStyle}>
        Upload a backup file to import data — accepts both{' '}
        <strong style={{ color: 'var(--color-text)' }}>.zip</strong> (exported from Genki) and raw{' '}
        <strong style={{ color: 'var(--color-text)' }}>.json</strong>. The strategy used is{' '}
        <strong style={{ color: 'var(--color-text)' }}>merge</strong> — monitors that already exist
        (same name + URL) will not be overwritten, but their logs and incidents will still be
        imported if not already present.
      </p>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !selectedFile && inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? '#e53e3e' : 'var(--color-border)'}`,
          borderRadius: 8,
          padding: '56px 20px',
          textAlign: 'center',
          cursor: selectedFile ? 'default' : 'pointer',
          background: dragOver ? 'rgba(229,62,62,0.04)' : 'var(--color-surface)',
          transition: 'border-color 0.15s, background 0.15s',
          marginBottom: 14,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".json,.zip,application/json,application/zip"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />

        {selectedFile ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <FileJson size={18} style={{ color: '#e53e3e', flexShrink: 0 }} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 13, color: 'var(--color-text)', fontWeight: 500 }}>
                {selectedFile.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                {(selectedFile.size / 1024).toFixed(1)} KB
              </div>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <Upload size={20} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                  Drag &amp; drop your backup file here, or{' '}
                  <span style={{ color: '#e53e3e', textDecoration: 'underline' }}>browse</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 2 }}>
                  Supported formats: .zip, .json
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Confirmation checkbox */}
      {selectedFile && !result && (
        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 8,
          fontSize: 12, color: 'var(--color-text-muted)',
          cursor: 'pointer', marginBottom: 14, userSelect: 'none',
        }}>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={e => setConfirmed(e.target.checked)}
            style={{ marginTop: 2, accentColor: '#e53e3e', flexShrink: 0 }}
          />
          I understand that this import will add data to the database. Existing monitors
          will not be overwritten (merge strategy).
        </label>
      )}

      {/* Action buttons */}
      {selectedFile && !result && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleImport}
            disabled={loading || !confirmed}
            style={{
              ...btnBase,
              background: loading || !confirmed ? 'var(--color-surface-hover)' : '#e53e3e',
              color: loading || !confirmed ? 'var(--color-text-muted)' : '#fff',
              cursor: loading || !confirmed ? 'not-allowed' : 'pointer',
            }}
          >
            {loading
              ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
              : <Upload size={13} />}
            {loading ? 'Importing…' : 'Import Now'}
          </button>

          <button
            onClick={handleClear}
            disabled={loading}
            style={{
              ...btnBase,
              background: 'transparent',
              color: 'var(--color-text-muted)',
              border: '1px solid var(--color-border)',
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: '#fc8181',
          background: 'rgba(229,62,62,0.08)',
          border: '1px solid rgba(229,62,62,0.2)',
          borderRadius: 6, padding: '8px 12px', marginTop: 12,
        }}>
          <AlertCircle size={13} /> {error}
        </div>
      )}

      {/* Success summary */}
      {result && <ImportSummary result={result} onReset={handleClear} />}
    </Card>
  )
}

function ImportSummary({ result, onReset }: { result: ImportResult; onReset: () => void }) {
  const rows: Array<{ label: string; value: number; color?: string }> = [
    { label: 'Monitors created', value: result.monitors_created, color: '#68d391' },
    { label: 'Monitors skipped (already exist)', value: result.monitors_skipped },
    { label: 'Log entries imported', value: result.logs_imported },
    { label: 'Incidents imported', value: result.incidents_created },
  ]

  return (
    <div style={{
      background: 'rgba(72,187,120,0.08)',
      border: '1px solid rgba(72,187,120,0.25)',
      borderRadius: 8,
      padding: 16,
      marginTop: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <CheckCircle size={15} style={{ color: '#68d391', flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#68d391' }}>Import successful</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', marginBottom: 14 }}>
        {rows.map(r => (
          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--color-text-muted)' }}>{r.label}</span>
            <span style={{ fontWeight: 600, color: r.color ?? 'var(--color-text)' }}>{r.value}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onReset}
        style={{
          ...btnBase,
          background: 'transparent',
          color: 'var(--color-text-muted)',
          border: '1px solid var(--color-border)',
          padding: '6px 14px',
          fontSize: 12,
        }}
      >
        Import Another File
      </button>
    </div>
  )
}

export default function BackupRestoreTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: '50%' }}>
      <ExportSection />
      <ImportSection />
    </div>
  )
}
