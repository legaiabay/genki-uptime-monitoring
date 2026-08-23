import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Monitor } from '@/types'

export interface CreateMonitorPayload {
  name: string
  url: string
  type: 'http' | 'tcp' | 'ping'
  interval: number
  timeout: number
  expected_status: number
  max_retries: number
  group_name: string
  labels: string[]
}

async function fetchMonitors(): Promise<Monitor[]> {
  const res = await api.get<{ data: Monitor[] }>('/monitors')
  return res.data.data
}

async function fetchMonitor(id: number): Promise<Monitor> {
  const res = await api.get<{ data: Monitor }>(`/monitors/${id}`)
  return res.data.data
}

async function fetchGroups(): Promise<string[]> {
  const res = await api.get<{ data: string[] }>('/monitors/groups')
  return res.data.data
}

async function createMonitor(payload: CreateMonitorPayload): Promise<Monitor> {
  const res = await api.post<{ data: Monitor }>('/monitors', payload)
  return res.data.data
}

async function updateMonitor(id: number, payload: Partial<CreateMonitorPayload>): Promise<Monitor> {
  const res = await api.put<{ data: Monitor }>(`/monitors/${id}`, payload)
  return res.data.data
}

async function deleteMonitor(id: number): Promise<void> {
  await api.delete(`/monitors/${id}`)
}

export function useMonitors() {
  return useQuery<Monitor[]>({
    queryKey: ['monitors'],
    queryFn: fetchMonitors,
    refetchInterval: 30_000,
  })
}

export function useMonitor(id: number) {
  return useQuery<Monitor>({
    queryKey: ['monitors', id],
    queryFn: () => fetchMonitor(id),
    enabled: !!id,
  })
}

export function useGroups() {
  return useQuery<string[]>({
    queryKey: ['monitor-groups'],
    queryFn: fetchGroups,
    staleTime: 60_000,
  })
}

export function useCreateMonitor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createMonitor,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['monitors'] })
      qc.invalidateQueries({ queryKey: ['monitor-groups'] })
    },
  })
}

export function useUpdateMonitor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<CreateMonitorPayload> }) =>
      updateMonitor(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['monitors'] })
      qc.invalidateQueries({ queryKey: ['monitor-groups'] })
    },
  })
}

export function useDeleteMonitor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteMonitor,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['monitors'] })
      qc.invalidateQueries({ queryKey: ['monitor-groups'] })
    },
  })
}

async function toggleVisibility(id: number, isPublic: boolean): Promise<Monitor> {
  const res = await api.patch<{ data: Monitor }>(`/monitors/${id}/visibility`, { public: isPublic })
  return res.data.data
}

export function useToggleVisibility() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isPublic }: { id: number; isPublic: boolean }) =>
      toggleVisibility(id, isPublic),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['monitors'] }),
  })
}
