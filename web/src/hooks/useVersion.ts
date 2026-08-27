import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { VersionInfo } from '@/types'

async function fetchVersion(): Promise<VersionInfo> {
  const res = await api.get<VersionInfo>('/version')
  return res.data
}

export function useVersion() {
  return useQuery<VersionInfo>({
    queryKey: ['version'],
    queryFn: fetchVersion,
    // Check once per hour — no need to hammer GitHub API
    staleTime: 60 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
    // Don't retry on failure — GitHub may just be unreachable
    retry: false,
  })
}
