import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { ApiKey } from '@/types'

// ── Fetchers ──────────────────────────────────────────────────────────────────

async function fetchApiKeys(): Promise<ApiKey[]> {
  const res = await api.get<{ data: ApiKey[] }>('/api-keys')
  return res.data.data
}

async function createApiKey(name: string): Promise<ApiKey> {
  const res = await api.post<{ data: ApiKey }>('/api-keys', { name })
  return res.data.data
}

async function deleteApiKey(id: number): Promise<void> {
  await api.delete(`/api-keys/${id}`)
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useApiKeys() {
  return useQuery<ApiKey[]>({
    queryKey: ['api-keys'],
    queryFn: fetchApiKeys,
  })
}

export function useCreateApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createApiKey,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  })
}

export function useDeleteApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteApiKey,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  })
}
