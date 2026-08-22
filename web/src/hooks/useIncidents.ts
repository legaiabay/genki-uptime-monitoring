import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Incident, IncidentStatus } from '@/types'

async function fetchIncidents(): Promise<Incident[]> {
  const res = await api.get<{ data: Incident[] }>('/incidents')
  return res.data.data
}

async function updateIncident(id: number, status: IncidentStatus): Promise<Incident> {
  const res = await api.put<{ data: Incident }>(`/incidents/${id}`, { status })
  return res.data.data
}

export function useIncidents() {
  return useQuery<Incident[]>({
    queryKey: ['incidents'],
    queryFn: fetchIncidents,
    refetchInterval: 30_000,
  })
}

export function useUpdateIncident() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: IncidentStatus }) =>
      updateIncident(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['incidents'] }),
  })
}
