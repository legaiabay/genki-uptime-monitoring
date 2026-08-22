import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Heartbeat } from '@/types'

async function fetchHeartbeats(): Promise<Heartbeat[]> {
  const res = await api.get<{ data: Heartbeat[] }>('/heartbeats')
  return res.data.data
}

export function useHeartbeats() {
  return useQuery<Heartbeat[]>({
    queryKey: ['heartbeats'],
    queryFn: fetchHeartbeats,
    refetchInterval: 15_000,
  })
}
