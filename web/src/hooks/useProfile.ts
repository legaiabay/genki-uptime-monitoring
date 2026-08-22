import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface Profile {
  id: number
  name: string
  email: string
  role: string
  created_at: string
  updated_at: string
}

export interface AppSettings {
  site_name: string
  timezone: string
  default_interval: string
  retention_days: string
}

// ── Profile ───────────────────────────────────────────────────────────────────

async function fetchProfile(): Promise<Profile> {
  const res = await api.get<{ data: Profile }>('/profile')
  return res.data.data
}

async function updateProfile(payload: { name: string; email: string }): Promise<Profile> {
  const res = await api.put<{ data: Profile }>('/profile', payload)
  return res.data.data
}

async function changePassword(payload: {
  current_password: string
  new_password: string
  confirm_password: string
}): Promise<void> {
  await api.post('/profile/password', payload)
}

export function useProfile() {
  return useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: fetchProfile,
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  })
}

export function useChangePassword() {
  return useMutation({ mutationFn: changePassword })
}

// ── App Settings ──────────────────────────────────────────────────────────────

async function fetchAppSettings(): Promise<AppSettings> {
  const res = await api.get<{ data: AppSettings }>('/settings/general')
  return res.data.data
}

async function updateAppSettings(payload: Partial<AppSettings>): Promise<AppSettings> {
  const res = await api.put<{ data: AppSettings }>('/settings/general', payload)
  return res.data.data
}

export function useAppSettings() {
  return useQuery<AppSettings>({
    queryKey: ['settings', 'general'],
    queryFn: fetchAppSettings,
  })
}

export function useUpdateAppSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateAppSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'general'] }),
  })
}
