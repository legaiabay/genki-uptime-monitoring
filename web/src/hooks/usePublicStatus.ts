import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

export interface PublicLog {
  status: string
  response_time: number
  checked_at: string
}

export interface PublicMonitor {
  id: number
  name: string
  url: string
  type: string
  status: string
  uptime_percentage: number
  public_slug: string | null
  last_checked_at: string | null
  logs: PublicLog[]
}

export interface PublicStatusResponse {
  monitors: PublicMonitor[]
  overall_uptime: number
}

async function fetchPublicStatus(): Promise<PublicStatusResponse> {
  const res = await axios.get<PublicStatusResponse>('/api/v1/public/status')
  return res.data
}

export function usePublicStatus() {
  return useQuery<PublicStatusResponse>({
    queryKey: ['public', 'status'],
    queryFn: fetchPublicStatus,
    refetchInterval: 30_000,
  })
}
