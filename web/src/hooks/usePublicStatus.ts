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
  group_name: string
  labels: string[]
  last_checked_at: string | null
  logs: PublicLog[]
}

export interface PublicStatusResponse {
  monitors: PublicMonitor[]
  overall_uptime: number
  site_name: string
  show_url: boolean
  groups: string[]
}

export interface GroupPublicStatusResponse {
  monitors: PublicMonitor[]
  overall_uptime: number
  site_name: string
  show_url: boolean
  group_name: string
  group_slug: string
}

export interface PublicGroupInfo {
  group_name: string
  group_slug: string
  count: number
  has_down: boolean
  has_degraded: boolean
}

export interface PublicGroupsResponse {
  groups: PublicGroupInfo[]
  site_name: string
}

async function fetchPublicStatus(): Promise<PublicStatusResponse> {
  const res = await axios.get<PublicStatusResponse>('/api/v1/public/status')
  return res.data
}

async function fetchGroupPublicStatus(groupSlug: string): Promise<GroupPublicStatusResponse> {
  const res = await axios.get<GroupPublicStatusResponse>(
    `/api/v1/public/status/group/${encodeURIComponent(groupSlug)}`
  )
  return res.data
}

async function fetchPublicGroups(): Promise<PublicGroupsResponse> {
  const res = await axios.get<PublicGroupsResponse>('/api/v1/public/groups')
  return res.data
}

export function usePublicStatus() {
  return useQuery<PublicStatusResponse>({
    queryKey: ['public', 'status'],
    queryFn: fetchPublicStatus,
    refetchInterval: 30_000,
  })
}

export function useGroupPublicStatus(groupSlug: string) {
  return useQuery<GroupPublicStatusResponse>({
    queryKey: ['public', 'status', 'group', groupSlug],
    queryFn: () => fetchGroupPublicStatus(groupSlug),
    refetchInterval: 30_000,
    enabled: !!groupSlug,
  })
}

export function usePublicGroups() {
  return useQuery<PublicGroupsResponse>({
    queryKey: ['public', 'groups'],
    queryFn: fetchPublicGroups,
    refetchInterval: 60_000,
  })
}
