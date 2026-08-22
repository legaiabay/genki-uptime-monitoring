import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { OverviewStats } from '@/types'

async function fetchOverviewStats(): Promise<OverviewStats> {
  const res = await api.get<OverviewStats>('/stats/overview')
  return res.data
}

export function useOverviewStats() {
  return useQuery<OverviewStats>({
    queryKey: ['stats', 'overview'],
    queryFn: fetchOverviewStats,
    refetchInterval: 30_000,
  })
}
