import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { toast } from 'sonner'
import type { Favorites } from '@/api/contracts'
import { errorMessage } from '@/api/errors'
import { favoritesApi } from '@/api/services'
import { useCurrentUser } from '@/auth/use-session'
import { queryKeys } from './keys'

export function useFavorites() {
  const user = useCurrentUser()
  return useQuery({
    queryKey: queryKeys.private.favorites(user?.id ?? 'anonymous'),
    queryFn: ({ signal }) => favoritesApi.list({ signal }),
    enabled: user !== null,
    staleTime: 60_000,
  })
}

/**
 * Favoritar com atualização otimista: o coração muda na hora; se a API falhar,
 * o estado anterior é restaurado (rollback) e o usuário é avisado.
 * Visitantes são levados ao login e voltam para a mesma página.
 */
export function useToggleFavorite() {
  const user = useCurrentUser()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const href = useRouterState({ select: (s) => s.location.href })
  const key = queryKeys.private.favorites(user?.id ?? 'anonymous')

  const mutation = useMutation({
    mutationFn: ({ nftId, favorite }: { nftId: string; favorite: boolean; name: string }) =>
      favorite ? favoritesApi.add(nftId) : favoritesApi.remove(nftId),
    onMutate: async ({ nftId, favorite }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Favorites>(key)
      const current = new Set(previous?.nftIds ?? [])
      if (favorite) current.add(nftId)
      else current.delete(nftId)
      queryClient.setQueryData<Favorites>(key, { nftIds: [...current] })
      return { previous }
    },
    onError: (error, { favorite, name }, context) => {
      queryClient.setQueryData(key, context?.previous)
      toast.error(`Não foi possível ${favorite ? 'favoritar' : 'remover dos favoritos'} ${name}. ${errorMessage(error)}`)
    },
    onSuccess: (data, { favorite, name }) => {
      queryClient.setQueryData(key, data)
      toast.success(favorite ? `${name} adicionado à lista de interesse.` : `${name} removido da lista de interesse.`)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })

  return {
    isPending: mutation.isPending,
    toggle(nftId: string, name: string, favorite: boolean) {
      if (!user) {
        void navigate({ to: '/entrar', search: { redirect: href, reason: 'required' } })
        return
      }
      mutation.mutate({ nftId, favorite, name })
    },
  }
}
