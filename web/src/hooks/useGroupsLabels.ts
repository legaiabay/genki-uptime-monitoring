import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface GroupSummary {
  name: string
  monitor_count: number
}

export interface LabelSummary {
  name: string
  monitor_count: number
}

async function fetchGroupsWithCount(): Promise<GroupSummary[]> {
  const res = await api.get<{ data: GroupSummary[] }>('/settings/groups')
  return res.data.data
}

async function fetchLabelsWithCount(): Promise<LabelSummary[]> {
  const res = await api.get<{ data: LabelSummary[] }>('/settings/labels')
  return res.data.data
}

export function useGroupsWithCount() {
  return useQuery<GroupSummary[]>({
    queryKey: ['settings-groups'],
    queryFn: fetchGroupsWithCount,
    staleTime: 30_000,
  })
}

export function useLabelsWithCount() {
  return useQuery<LabelSummary[]>({
    queryKey: ['settings-labels'],
    queryFn: fetchLabelsWithCount,
    staleTime: 30_000,
  })
}

export function useRenameGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ oldName, newName }: { oldName: string; newName: string }) =>
      api.put(`/settings/groups/${encodeURIComponent(oldName)}`, { new_name: newName }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings-groups'] })
      qc.invalidateQueries({ queryKey: ['monitors'] })
      qc.invalidateQueries({ queryKey: ['monitor-groups'] })
    },
  })
}

export function useDeleteGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) =>
      api.delete(`/settings/groups/${encodeURIComponent(name)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings-groups'] })
      qc.invalidateQueries({ queryKey: ['monitors'] })
      qc.invalidateQueries({ queryKey: ['monitor-groups'] })
    },
  })
}

export function useRenameLabel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ oldName, newName }: { oldName: string; newName: string }) =>
      api.put(`/settings/labels/${encodeURIComponent(oldName)}`, { new_name: newName }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings-labels'] })
      qc.invalidateQueries({ queryKey: ['monitors'] })
    },
  })
}

export function useDeleteLabel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) =>
      api.delete(`/settings/labels/${encodeURIComponent(name)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings-labels'] })
      qc.invalidateQueries({ queryKey: ['monitors'] })
    },
  })
}
