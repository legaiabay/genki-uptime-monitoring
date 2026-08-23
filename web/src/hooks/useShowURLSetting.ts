import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

async function fetchShowURL(): Promise<boolean> {
  const res = await api.get<{ show_url: boolean }>('/settings/show-url')
  return res.data.show_url
}

async function setShowURL(showURL: boolean): Promise<boolean> {
  const res = await api.patch<{ show_url: boolean }>('/settings/show-url', { show_url: showURL })
  return res.data.show_url
}

export function useShowURLSetting() {
  return useQuery<boolean>({
    queryKey: ['settings', 'show-url'],
    queryFn: fetchShowURL,
    staleTime: 60_000,
  })
}

export function useToggleShowURL() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: setShowURL,
    onMutate: async (newValue) => {
      await qc.cancelQueries({ queryKey: ['settings', 'show-url'] })
      const prev = qc.getQueryData<boolean>(['settings', 'show-url'])
      qc.setQueryData(['settings', 'show-url'], newValue)
      return { prev }
    },
    onError: (_err, _vars, context) => {
      if (context?.prev !== undefined) {
        qc.setQueryData(['settings', 'show-url'], context.prev)
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['settings', 'show-url'] }),
  })
}
