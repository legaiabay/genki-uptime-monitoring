import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export interface UptimeMonitorSeries {
  id: number
  name: string
  color: string
  values: number[]               // uptime % per bucket
  response_time_values: number[] // avg response time ms per bucket (0 = no data)
}

export interface UptimeSeriesResponse {
  labels: string[]
  monitors: UptimeMonitorSeries[]
}

async function fetchUptimeSeries(range: string, favoritesOnly = false): Promise<UptimeSeriesResponse> {
  const params = new URLSearchParams({ range })
  if (favoritesOnly) params.set('favorites_only', 'true')
  const res = await api.get<UptimeSeriesResponse>(`/stats/uptime-series?${params}`)
  return res.data
}

export function useUptimeSeries(range: string, favoritesOnly = false) {
  return useQuery<UptimeSeriesResponse>({
    queryKey: ['stats', 'uptime-series', range, favoritesOnly],
    queryFn: () => fetchUptimeSeries(range, favoritesOnly),
    refetchInterval: 60_000,
    placeholderData: { labels: [], monitors: [] },
  })
}
