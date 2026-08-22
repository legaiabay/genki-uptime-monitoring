import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export type ChannelType = 'google_chat' | 'telegram' | 'slack' | 'webhook'

export interface NotificationChannel {
  id: number
  type: ChannelType
  name: string
  enabled: boolean
  config: Record<string, string>
  created_at: string
  updated_at: string
}

async function fetchChannels(): Promise<NotificationChannel[]> {
  const res = await api.get<{ data: NotificationChannel[] }>('/notifications')
  return res.data.data
}

async function upsertChannel(payload: {
  type: ChannelType
  name: string
  enabled: boolean
  config: Record<string, string>
}): Promise<NotificationChannel> {
  const res = await api.post<{ data: NotificationChannel }>('/notifications', payload)
  return res.data.data
}

async function deleteChannel(id: number): Promise<void> {
  await api.delete(`/notifications/${id}`)
}

async function setEnabled(id: number, enabled: boolean): Promise<NotificationChannel> {
  const res = await api.patch<{ data: NotificationChannel }>(`/notifications/${id}/enabled`, { enabled })
  return res.data.data
}

export function useNotificationChannels() {
  return useQuery<NotificationChannel[]>({
    queryKey: ['notifications'],
    queryFn: fetchChannels,
  })
}

export function useUpsertChannel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: upsertChannel,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useDeleteChannel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteChannel,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useSetChannelEnabled() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) => setEnabled(id, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}
