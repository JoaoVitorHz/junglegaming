import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AddCartItem, Cart } from '@/api/contracts'
import { cartApi } from '@/api/services'
import { useCartOwnerKey } from '@/auth/use-session'
import { noteResourceVersion } from '@/realtime/apply-events'
import { queryKeys } from './keys'

/**
 * O carrinho vive na API (visitante identificado por X-Cart-Id, usuário pela
 * sessão). O cache é por dono, então trocar de usuário nunca mostra o carrinho
 * de outra pessoa.
 */
export function useCart() {
  const owner = useCartOwnerKey()
  return useQuery({
    queryKey: queryKeys.private.cart(owner),
    queryFn: async ({ signal }) => {
      const cart = await cartApi.get({ signal })
      for (const item of cart.items) noteResourceVersion('nft', item.nftId, item.nftVersion)
      return cart
    },
    staleTime: 10_000,
  })
}

/** Mutations do carrinho: a resposta da API substitui o cache (fonte da verdade dos totais). */
function useCartMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<Cart>) {
  const owner = useCartOwnerKey()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: (cart) => queryClient.setQueryData(queryKeys.private.cart(owner), cart),
    onError: () => queryClient.invalidateQueries({ queryKey: queryKeys.private.cart(owner) }),
  })
}

export function useAddToCart() {
  return useCartMutation((item: AddCartItem) => cartApi.addItem(item))
}

export function useRemoveCartItem() {
  return useCartMutation((itemId: string) => cartApi.removeItem(itemId))
}

export function useApplyCoupon() {
  return useCartMutation((code: string) => cartApi.applyCoupon(code))
}

export function useRemoveCoupon() {
  return useCartMutation(() => cartApi.removeCoupon())
}

export function useAcknowledgeCart() {
  return useCartMutation(() => cartApi.acknowledge())
}

/**
 * Alteração de quantidade com atualização otimista: o item muda na hora e o
 * resumo é recalculado pela resposta da API; em falha, o cache volta ao
 * estado anterior (rollback).
 */
export function useUpdateCartQuantity() {
  const owner = useCartOwnerKey()
  const queryClient = useQueryClient()
  const key = queryKeys.private.cart(owner)
  return useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) => cartApi.updateItem(itemId, quantity),
    onMutate: async ({ itemId, quantity }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Cart>(key)
      if (previous) {
        queryClient.setQueryData<Cart>(key, {
          ...previous,
          items: previous.items.map((item) => (item.id === itemId ? { ...item, quantity } : item)),
          itemCount: previous.items.reduce((sum, item) => sum + (item.id === itemId ? quantity : item.quantity), 0),
        })
      }
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSuccess: (cart) => queryClient.setQueryData(key, cart),
  })
}
