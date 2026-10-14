/**
 * Aplicação dos eventos Socket.IO no cache do TanStack Query.
 *
 * Garantias:
 *  - idempotência: cada `event.id` é aplicado no máximo uma vez;
 *  - ordenação: um evento com `version` menor ou igual à já conhecida para o
 *    recurso é descartado (não regride estado mais recente);
 *  - isolamento: `order.updated` de outro usuário é ignorado.
 */
import type { QueryClient } from '@tanstack/react-query'
import type {
  Cart,
  FeaturedResponse,
  NftDetail,
  NftListResponse,
  NftSummary,
  NftUpdatedEvent,
  Order,
  OrderUpdatedEvent,
} from '@/api/contracts'
import { compareEth, formatEth } from '@/lib/eth'
import { queryKeys } from '@/queries/keys'

const SEEN_LIMIT = 500
const seenEvents = new Set<string>()
const resourceVersions = new Map<string, number>()

function markSeen(id: string) {
  seenEvents.add(id)
  if (seenEvents.size > SEEN_LIMIT) {
    const oldest = seenEvents.values().next().value
    if (oldest) seenEvents.delete(oldest)
  }
}

/** Decide se o evento deve ser aplicado e registra o resultado. */
function accept(event: { id: string; version: number; resource: { type: string; id: string } }) {
  if (seenEvents.has(event.id)) return false
  markSeen(event.id)
  const key = `${event.resource.type}:${event.resource.id}`
  const known = resourceVersions.get(key) ?? 0
  if (event.version <= known) return false
  resourceVersions.set(key, event.version)
  return true
}

/** Registra versões vindas do REST, para que eventos antigos não as sobrescrevam. */
export function noteResourceVersion(type: 'nft' | 'order', id: string, version: number) {
  const key = `${type}:${id}`
  if (version > (resourceVersions.get(key) ?? 0)) resourceVersions.set(key, version)
}

export function resetEventTracking() {
  seenEvents.clear()
  resourceVersions.clear()
}

export type RealtimeNotice = { tone: 'info' | 'warning' | 'success' | 'error'; message: string }

function patchSummary<T extends NftSummary>(item: T, event: NftUpdatedEvent): T {
  if (item.id !== event.resource.id || item.version >= event.version) return item
  return {
    ...item,
    price: event.data.price,
    totalAvailable: event.data.editions.reduce((sum, e) => sum + e.available, 0),
    version: event.version,
  }
}

export function applyNftUpdated(queryClient: QueryClient, event: NftUpdatedEvent): RealtimeNotice | null {
  if (!accept(event)) return null

  queryClient.setQueriesData<NftListResponse>({ queryKey: queryKeys.nfts.lists }, (data) =>
    data ? { ...data, items: data.items.map((item) => patchSummary(item, event)) } : data,
  )
  queryClient.setQueriesData<FeaturedResponse>({ queryKey: queryKeys.nfts.featured }, (data) =>
    data ? { hero: data.hero.map((i) => patchSummary(i, event)), spotlight: patchSummary(data.spotlight, event) } : data,
  )
  queryClient.setQueriesData<NftDetail>({ queryKey: queryKeys.nfts.details }, (data) => {
    if (!data || data.id !== event.resource.id || data.version >= event.version) return data
    const editions = data.editions.map((edition) => ({
      ...edition,
      available: event.data.editions.find((e) => e.id === edition.id)?.available ?? edition.available,
    }))
    return {
      ...patchSummary(data, event),
      editions,
    }
  })

  // Carrinhos que contêm o NFT: o servidor recalcula status e totais.
  let notice: RealtimeNotice | null = null
  for (const [key, cart] of queryClient.getQueriesData<Cart>({ queryKey: queryKeys.private.all })) {
    if (key[2] !== 'cart' || !cart) continue
    // O carrinho já reflete esta versão (ou uma mais nova) do NFT: nada a fazer.
    const lines = cart.items.filter((item) => item.nftId === event.resource.id && item.nftVersion < event.version)
    if (lines.length === 0) continue
    void queryClient.invalidateQueries({ queryKey: key, exact: true })
    const line = lines[0]!
    const edition = event.data.editions.find((e) => e.id === line.editionId)
    if (compareEth(event.data.price, line.unitPrice) !== 0) {
      notice = {
        tone: 'warning',
        message: `O preço de ${line.name} mudou de ${formatEth(line.unitPrice)} para ${formatEth(event.data.price)}. O resumo foi atualizado.`,
      }
    } else if (edition && edition.available < line.quantity) {
      notice = {
        tone: 'warning',
        message:
          edition.available === 0
            ? `${line.name} (edição ${line.editionLabel}) esgotou. Revise seu carrinho.`
            : `${line.name} (edição ${line.editionLabel}) agora tem apenas ${edition.available} disponível(is).`,
      }
    }
  }
  return notice
}

export function applyOrderUpdated(
  queryClient: QueryClient,
  event: OrderUpdatedEvent,
  currentUserId: string | null,
): RealtimeNotice | null {
  // Evento de outro usuário (ou de sessão anterior): nunca toca o cache atual.
  if (!currentUserId || event.userId !== currentUserId) return null
  if (!accept(event)) return null

  const key = queryKeys.private.order(currentUserId, event.resource.id)
  const cached = queryClient.getQueryData<Order>(key)
  if (cached && cached.version < event.version) {
    queryClient.setQueryData<Order>(key, {
      ...cached,
      status: event.data.status,
      statusReason: event.data.statusReason,
      version: event.version,
      updatedAt: event.occurredAt,
    })
  }
  // Recibo completo e demais dados afetados vêm do REST.
  void queryClient.invalidateQueries({ queryKey: key, exact: true })
  void queryClient.invalidateQueries({ queryKey: queryKeys.private.pendingOrders(currentUserId) })
  if (event.data.status === 'confirmed') {
    void queryClient.invalidateQueries({ queryKey: queryKeys.private.cart(currentUserId) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.nfts.all })
    return { tone: 'success', message: 'Pagamento confirmado. Seus NFTs estão na sua carteira.' }
  }
  if (event.data.status === 'rejected') {
    return { tone: 'error', message: `Pagamento recusado. ${event.data.statusReason ?? ''}`.trim() }
  }
  return null
}
