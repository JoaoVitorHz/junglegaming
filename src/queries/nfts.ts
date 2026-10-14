import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { NftListQuery } from '@/api/contracts'
import { nftApi } from '@/api/services'
import { noteResourceVersion } from '@/realtime/apply-events'
import { queryKeys } from './keys'

/**
 * Listagem do catálogo. A chave inclui todos os parâmetros enviados à API,
 * então cada combinação tem seu cache; ao mudar a consulta a requisição
 * anterior é abortada (signal) e uma resposta atrasada nunca sobrescreve a
 * atual. `keepPreviousData` mantém a página visível durante a troca.
 */
export function useNftList(query: NftListQuery, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.nfts.list(query),
    queryFn: async ({ signal }) => {
      const result = await nftApi.list(query, { signal })
      for (const item of result.items) noteResourceVersion('nft', item.id, item.version)
      return result
    },
    placeholderData: keepPreviousData,
    enabled: options.enabled,
  })
}

export function useFeatured() {
  return useQuery({
    queryKey: queryKeys.nfts.featured,
    queryFn: ({ signal }) => nftApi.featured({ signal }),
    staleTime: 60_000,
  })
}

export function useNftDetail(slug: string) {
  return useQuery({
    queryKey: queryKeys.nfts.detail(slug),
    queryFn: async ({ signal }) => {
      const nft = await nftApi.detail(slug, { signal })
      noteResourceVersion('nft', nft.id, nft.version)
      return nft
    },
  })
}
