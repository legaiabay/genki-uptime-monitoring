import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export interface UptimeMonitorSeries {
  id: number
  name: string
  color: string
  values: number[]
}

export interface UptimeSeriesResponse {
  labels: string[]
  monitors: UptimeMonitorSeries[]
}

async function fetchUptimeSeries(range: string): Promise<UptimeSeriesResponse> {
  const res = await api.get<UptimeSeriesResponse>(`/stats/uptime-series?range=${range}`)
  return res.data
}

export function useUptimeSeries(range: string) {
  return useQuery<UptimeSeriesResponse>({
    queryKey: ['stats', 'uptime-series', range],
    queryFn: () => fetchUptimeSeries(range),
    refetchInterval: 60_000,
    placeholderData: { labels: [], monitors: [] },
  })
}
