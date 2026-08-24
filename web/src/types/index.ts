export type MonitorType = 'http' | 'tcp' | 'ping' | 'dns' | 'ssl' | 'grpc' | 'udp'
export type MonitorStatus = 'up' | 'down' | 'degraded' | 'pending'
export type IncidentStatus = 'investigating' | 'identified' | 'resolved'

export interface Monitor {
  id: number
  name: string
  url: string
  type: MonitorType
  interval: number
  timeout: number
  status: MonitorStatus
  active: boolean
  expected_status: number
  max_retries: number
  uptime_percentage: number
  public: boolean
  public_slug: string | null
  group_name: string
  labels: string[]
  favorite: boolean
  last_checked_at: string | null
  last_response_time: number | null
  created_at: string
  updated_at: string
  // Type-specific fields
  dns_record_type: string
  dns_expected_ip: string
  ssl_warning_days: number
  ssl_expiry_date: string | null
  grpc_service: string
  grpc_method: string
}

export interface MonitorLog {
  id: number
  monitor_id: number
  status: MonitorStatus
  response_time: number
  status_code: number | null
  message: string
  checked_at: string
}

export interface Incident {
  id: number
  monitor_id: number | null
  title: string
  description: string
  status: IncidentStatus
  started_at: string
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export interface Heartbeat {
  id: number
  monitor_id: number
  status: string
  ping: number
  message: string
  created_at: string
}

export interface OverviewStats {
  total_monitors: number
  uptime_percentage: number
  avg_response_time: number
  incident_count: number
}

export interface ApiKey {
  id: number
  user_id: number
  name: string
  key_prefix: string   // masked — only first 10 chars + "…" (list endpoint)
  key?: string         // full key — only present in the create response
  last_used: string | null
  expires_at: string | null
  created_at: string
}

export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  page_size: number
}
