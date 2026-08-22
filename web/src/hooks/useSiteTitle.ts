import { useEffect } from 'react'
import { useAppSettings } from './useProfile'

/**
 * Reads site_name from app settings and keeps document.title in sync.
 * Call this once in a top-level component (e.g. Layout).
 */
export function useSiteTitle() {
  const { data: settings } = useAppSettings()

  useEffect(() => {
    const name = settings?.site_name?.trim()
    if (name) {
      document.title = name
    }
  }, [settings?.site_name])
}
