import { useQuery } from '@tanstack/react-query'
import { ordersApi } from '@/api/services'
import { useCurrentUser } from '@/auth/use-session'
import { local } from '@/lib/storage'
import { noteResourceVersion } from '@/realtime/apply-events'
import { queryKeys } from './keys'

/**
 * Pedido por id. Enquanto pendente, além do evento `order.updated`, consulta a
 * API periodicamente — cobre eventos perdidos durante uma queda de conexão.
 */
export function useOrder(orderId: string | null) {
  const user = useCurrentUser()
  return useQuery({
    queryKey: queryKeys.private.order(user?.id ?? 'anonymous', orderId ?? 'none'),
    queryFn: async ({ signal }) => {
      const order = await ordersApi.get(orderId!, { signal })
      noteResourceVersion('order', order.id, order.version)
      return order
    },
    enabled: user !== null && orderId !== null,
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 3000 : false),
  })
}

/** Pedidos pendentes do usuário na API (fonte da verdade para retomar após refresh). */
export function usePendingOrders() {
  const user = useCurrentUser()
  return useQuery({
    queryKey: queryKeys.private.pendingOrders(user?.id ?? 'anonymous'),
    queryFn: async ({ signal }) => (await ordersApi.pending({ signal })).items,
    enabled: user !== null,
    staleTime: 0,
  })
}

const pendingKey = (userId: string) => `kurio:pending-order:${userId}`

/** Último pedido enviado pelo usuário neste navegador (para retomar o acompanhamento). */
export const pendingOrderStorage = {
  get: (userId: string) => local.get<string>(pendingKey(userId)),
  set: (userId: string, orderId: string) => local.set(pendingKey(userId), orderId),
  clear: (userId: string) => local.remove(pendingKey(userId)),
}
