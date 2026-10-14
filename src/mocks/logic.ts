/**
 * Regras de negócio do "servidor" simulado. Os handlers REST só fazem
 * parsing/validação e delegam para cá; assim REST e eventos Socket.IO
 * derivam do mesmo estado.
 */
import type {
  Cart,
  CartItem,
  LineStatus,
  NftDetail,
  NftListQuery,
  NftListResponse,
  NftSummary,
  NftUpdatedEvent,
  Order,
  Quote,
  Totals,
  User,
} from '@/api/contracts'
import { headers } from '@/api/endpoints'
import { addEth, compareEth, mulEth, percentOfEth, subEth } from '@/lib/eth'
import { db, nextEventId, nextId, persist, type CartRecord, type OrderRecord } from './db'
import { fail } from './http'
import { publish, revokeUser } from './realtime'
import { getScenario, schedule } from './runtime'
import { coupons, NETWORK_FEE, NEW_RELEASE_WINDOW_DAYS, type UserRecord } from './seed'

/* -------------------------------------------------------------------------- */
/*                                   Sessão                                   */
/* -------------------------------------------------------------------------- */

export async function hashPassword(salt: string, password: string) {
  const bytes = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function publicUser(user: UserRecord): User {
  const { passwordHash: _hash, salt: _salt, ...rest } = user
  return rest
}

export function createSession(userId: string) {
  const token = `tok_${crypto.randomUUID()}`
  const now = Date.now()
  const session = { token, userId, createdAt: now, expiresAt: now + getScenario().sessionTtlSeconds * 1000 }
  db.sessions[token] = session
  persist()
  return session
}

export function readToken(request: Request) {
  const auth = request.headers.get('Authorization')
  return auth?.startsWith('Bearer ') ? auth.slice(7) : null
}

/** Exige sessão válida. Diferencia ausência de sessão de sessão expirada. */
export function requireUser(request: Request): UserRecord {
  const token = readToken(request)
  if (!token) fail('UNAUTHENTICATED', 'Faça login para continuar.')
  const session = db.sessions[token]
  if (!session) fail('UNAUTHENTICATED', 'Sessão inválida. Faça login novamente.')
  if (session.expiresAt <= Date.now()) {
    delete db.sessions[token]
    revokeUser(session.userId)
    persist()
    fail('SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.')
  }
  const user = db.users[session.userId]
  if (!user) fail('UNAUTHENTICATED', 'Sessão inválida. Faça login novamente.')
  return user
}

export function optionalUser(request: Request): UserRecord | null {
  const token = readToken(request)
  if (!token) return null
  return requireUser(request)
}

/* -------------------------------------------------------------------------- */
/*                                  Catálogo                                  */
/* -------------------------------------------------------------------------- */

export function toSummary(nft: NftDetail): NftSummary {
  return {
    id: nft.id,
    slug: nft.slug,
    name: nft.name,
    tokenId: nft.tokenId,
    collection: nft.collection,
    category: nft.category,
    network: nft.network,
    image: nft.image,
    price: nft.price,
    compareAtPrice: nft.compareAtPrice,
    rarity: nft.rarity,
    rating: nft.rating,
    reviewCount: nft.reviewCount,
    totalAvailable: nft.totalAvailable,
    createdAt: nft.createdAt,
    version: nft.version,
  }
}

function normalize(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function listNfts(query: NftListQuery): NftListResponse {
  const all = getScenario().emptyCatalog ? [] : Object.values(db.nfts)
  const newest = all.reduce((max, n) => Math.max(max, Date.parse(n.createdAt)), 0)

  const matchesText = (n: NftDetail) => {
    if (!query.q) return true
    const q = normalize(query.q.trim())
    return [n.name, n.collection, n.tokenId, ...n.attributes].some((field) => normalize(field).includes(q))
  }
  const matchesTab = (n: NftDetail) => {
    if (query.tab === 'new') return newest - Date.parse(n.createdAt) <= NEW_RELEASE_WINDOW_DAYS * 86_400_000
    if (query.tab === 'trending') return n.reviewCount >= 15
    return true
  }
  const matchesPrice = (n: NftDetail) =>
    (!query.minPrice || compareEth(n.price, query.minPrice) >= 0) &&
    (!query.maxPrice || compareEth(n.price, query.maxPrice) <= 0)

  // Facetas consideram os demais filtros, mas não o próprio (filtros combináveis).
  const base = all.filter(
    (n) =>
      matchesText(n) &&
      matchesTab(n) &&
      (!query.collection || n.collection === query.collection) &&
      (!query.exclude || n.id !== query.exclude),
  )
  const byCategory = base.filter(
    (n) => matchesPrice(n) && (!query.networks?.length || query.networks.includes(n.network)),
  )
  const byNetwork = base.filter(
    (n) => matchesPrice(n) && (!query.categories?.length || query.categories.includes(n.category)),
  )
  const filtered = byCategory.filter((n) => !query.categories?.length || query.categories.includes(n.category))

  const sorted = [...filtered].sort((a, b) => {
    switch (query.sort) {
      case 'price-asc':
        return compareEth(a.price, b.price) || a.name.localeCompare(b.name)
      case 'price-desc':
        return compareEth(b.price, a.price) || a.name.localeCompare(b.name)
      case 'popular':
        return b.reviewCount - a.reviewCount || a.name.localeCompare(b.name)
      default:
        return Date.parse(b.createdAt) - Date.parse(a.createdAt)
    }
  })

  const pageSize = query.pageSize ?? 9
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const page = query.page ?? 1
  const start = (page - 1) * pageSize

  const count = (items: NftDetail[], key: 'category' | 'network') => {
    const map = new Map<string, number>()
    for (const n of items) map.set(n[key], (map.get(n[key]) ?? 0) + 1)
    return [...map].map(([value, c]) => ({ value, count: c }))
  }
  const prices = base.map((n) => n.price).sort(compareEth)

  return {
    items: sorted.slice(start, start + pageSize).map(toSummary),
    page,
    pageSize,
    total: sorted.length,
    totalPages,
    facets: {
      categories: count(byCategory, 'category'),
      networks: count(byNetwork, 'network'),
      priceRange: { min: prices[0] ?? '0', max: prices[prices.length - 1] ?? '0' },
    },
  }
}

export function findNftBySlug(slug: string) {
  return Object.values(db.nfts).find((n) => n.slug === slug) ?? null
}

/** Atualiza preço/disponibilidade, incrementa versão e publica `nft.updated`. */
export function updateNft(
  nftId: string,
  change: { price?: string; editions?: { id: string; available: number }[] },
) {
  const nft = db.nfts[nftId]
  if (!nft) return null
  if (change.price) nft.price = change.price
  for (const e of change.editions ?? []) {
    const edition = nft.editions.find((x) => x.id === e.id)
    if (edition) edition.available = Math.max(0, e.available)
  }
  nft.totalAvailable = nft.editions.reduce((sum, e) => sum + e.available, 0)
  nft.version += 1
  persist()
  const event: NftUpdatedEvent = {
    id: nextEventId(),
    type: 'nft.updated',
    resource: { type: 'nft', id: nft.id },
    version: nft.version,
    occurredAt: new Date().toISOString(),
    data: { price: nft.price, editions: nft.editions.map((e) => ({ id: e.id, available: e.available })) },
  }
  persist()
  publish(event)
  return event
}

/* -------------------------------------------------------------------------- */
/*                                  Carrinho                                  */
/* -------------------------------------------------------------------------- */

function newCart(ownerType: 'guest' | 'user', ownerId: string | null, id?: string): CartRecord {
  const cart: CartRecord = { id: id ?? nextId('cart'), ownerType, ownerId, items: [], couponCode: null, version: 1 }
  db.carts[cart.id] = cart
  return cart
}

/**
 * Resolve o carrinho da requisição: o do usuário autenticado ou o do visitante
 * identificado pelo cabeçalho X-Cart-Id (gerado pelo cliente).
 */
export function resolveCart(request: Request): CartRecord {
  const user = optionalUser(request)
  if (user) {
    const id = db.userCarts[user.id]
    const existing = id ? db.carts[id] : undefined
    if (existing) return existing
    const cart = newCart('user', user.id)
    db.userCarts[user.id] = cart.id
    persist()
    return cart
  }
  const guestId = request.headers.get(headers.cartId)
  if (!guestId || !/^guest_[\w-]{8,64}$/.test(guestId)) {
    fail('VALIDATION_ERROR', 'Identificador de carrinho ausente.')
  }
  const existing = db.carts[guestId]
  if (existing && existing.ownerType === 'guest') return existing
  const cart = newCart('guest', null, guestId)
  persist()
  return cart
}

/** Preserva os itens do visitante ao autenticar, respeitando a disponibilidade. */
export function mergeGuestCart(guestCartId: string | null, userId: string) {
  if (!guestCartId) return
  const guest = db.carts[guestCartId]
  if (!guest || guest.ownerType !== 'guest' || guest.items.length === 0) return
  const userCartId = db.userCarts[userId]
  const target = (userCartId && db.carts[userCartId]) || newCart('user', userId)
  db.userCarts[userId] = target.id
  for (const line of guest.items) {
    const existing = target.items.find((l) => l.nftId === line.nftId && l.editionId === line.editionId)
    const limit = lineLimit(line.nftId, line.editionId)
    if (existing) existing.quantity = Math.min(existing.quantity + line.quantity, Math.max(limit, 1))
    else target.items.push({ ...line, id: nextId('line') })
  }
  if (!target.couponCode && guest.couponCode) target.couponCode = guest.couponCode
  target.version += 1
  delete db.carts[guestCartId]
  persist()
}

export function lineLimit(nftId: string, editionId: string) {
  const nft = db.nfts[nftId]
  const edition = nft?.editions.find((e) => e.id === editionId)
  if (!nft || !edition) return 0
  return Math.min(edition.available, nft.maxPerOrder)
}

function lineStatus(line: CartRecord['items'][number]): { status: LineStatus; available: number; unitPrice: string } {
  const nft = db.nfts[line.nftId]
  const edition = nft?.editions.find((e) => e.id === line.editionId)
  if (!nft || !edition) return { status: 'unavailable', available: 0, unitPrice: line.acknowledgedUnitPrice }
  if (edition.available === 0) return { status: 'unavailable', available: 0, unitPrice: nft.price }
  if (line.quantity > edition.available) return { status: 'insufficient', available: edition.available, unitPrice: nft.price }
  if (compareEth(nft.price, line.acknowledgedUnitPrice) !== 0) {
    return { status: 'price_changed', available: edition.available, unitPrice: nft.price }
  }
  return { status: 'ok', available: edition.available, unitPrice: nft.price }
}

export function findCoupon(code: string) {
  return coupons.find((c) => c.code === code.trim().toUpperCase()) ?? null
}

export function computeTotals(lines: { quantity: number; unitPrice: string; status: LineStatus }[], couponCode: string | null): Totals {
  const billable = lines.filter((l) => l.status !== 'unavailable')
  const subtotal = billable.reduce((acc, l) => addEth(acc, mulEth(l.unitPrice, l.quantity)), '0')
  const coupon = couponCode ? findCoupon(couponCode) : null
  const discount = coupon ? percentOfEth(subtotal, coupon.percentOff * 100) : '0'
  const networkFee = billable.length > 0 ? NETWORK_FEE : '0'
  return { subtotal, discount, networkFee, total: addEth(subEth(subtotal, discount), networkFee) }
}

export function serializeCart(cart: CartRecord): Cart {
  const items: CartItem[] = []
  for (const line of cart.items) {
    const nft = db.nfts[line.nftId]
    if (!nft) continue
    const edition = nft.editions.find((e) => e.id === line.editionId)
    const { status, available, unitPrice } = lineStatus(line)
    items.push({
      id: line.id,
      nftId: nft.id,
      slug: nft.slug,
      editionId: line.editionId,
      editionLabel: edition?.label ?? line.editionId,
      name: nft.name,
      tokenId: nft.tokenId,
      image: nft.image,
      quantity: line.quantity,
      unitPrice,
      acknowledgedUnitPrice: line.acknowledgedUnitPrice,
      lineTotal: mulEth(unitPrice, line.quantity),
      available,
      maxPerOrder: nft.maxPerOrder,
      status,
      nftVersion: nft.version,
    })
  }
  const coupon = cart.couponCode ? findCoupon(cart.couponCode) : null
  return {
    id: cart.id,
    ownerType: cart.ownerType,
    items,
    coupon: coupon ? { code: coupon.code, percentOff: coupon.percentOff, description: coupon.description } : null,
    totals: computeTotals(items, cart.couponCode),
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    hasChanges: items.some((i) => i.status !== 'ok'),
    version: cart.version,
  }
}

/** Aceita as alterações: confirma preços atuais e ajusta quantidades ao disponível. */
export function acknowledgeCart(cart: CartRecord) {
  cart.items = cart.items.flatMap((line) => {
    const nft = db.nfts[line.nftId]
    const edition = nft?.editions.find((e) => e.id === line.editionId)
    if (!nft || !edition || edition.available === 0) return []
    return [{ ...line, quantity: Math.min(line.quantity, edition.available, nft.maxPerOrder), acknowledgedUnitPrice: nft.price }]
  })
  cart.version += 1
  persist()
}

/* -------------------------------------------------------------------------- */
/*                                   Cotação                                  */
/* -------------------------------------------------------------------------- */

const QUOTE_TTL_MS = 5 * 60_000

function fingerprint(cart: Cart) {
  return JSON.stringify({
    items: cart.items.map((i) => [i.nftId, i.editionId, i.quantity, i.unitPrice, i.status]),
    coupon: cart.coupon?.code ?? null,
    totals: cart.totals,
  })
}

export function createQuote(cart: CartRecord, userId: string): Quote {
  const serialized = serializeCart(cart)
  const issues: string[] = []
  for (const item of serialized.items) {
    if (item.status === 'price_changed') issues.push(`O preço de ${item.name} mudou para ${item.unitPrice} ETH.`)
    if (item.status === 'insufficient') issues.push(`${item.name} (${item.editionLabel}) tem apenas ${item.available} disponível(is).`)
    if (item.status === 'unavailable') issues.push(`${item.name} (${item.editionLabel}) esgotou.`)
  }
  if (serialized.items.length === 0) issues.push('O carrinho está vazio.')
  const now = Date.now()
  const id = nextId('quo')
  db.quotes[id] = {
    id,
    userId,
    cartId: cart.id,
    cartVersion: cart.version,
    fingerprint: fingerprint(serialized),
    createdAt: now,
    expiresAt: now + QUOTE_TTL_MS,
  }
  persist()
  return {
    id,
    cartVersion: cart.version,
    items: serialized.items.map((i) => ({
      nftId: i.nftId,
      editionId: i.editionId,
      name: i.name,
      tokenId: i.tokenId,
      image: i.image,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
      status: i.status,
    })),
    coupon: serialized.coupon,
    totals: serialized.totals,
    valid: issues.length === 0,
    issues,
    expiresAt: new Date(now + QUOTE_TTL_MS).toISOString(),
  }
}

/** Uma cotação continua válida se nada do que ela precificou mudou. */
export function isQuoteCurrent(quoteId: string, cart: CartRecord) {
  const quote = db.quotes[quoteId]
  if (!quote || quote.cartId !== cart.id || quote.expiresAt <= Date.now()) return false
  const serialized = serializeCart(cart)
  return !serialized.hasChanges && quote.fingerprint === fingerprint(serialized)
}

/** Cenário: após a primeira cotação de um checkout, o primeiro item muda. */
export function maybeTriggerCheckoutChange(cart: CartRecord) {
  const mode = getScenario().checkoutChange
  const first = cart.items[0]
  if (!mode || !first || db.checkoutChangeFired[cart.id]) return
  db.checkoutChangeFired[cart.id] = true
  persist()
  schedule(() => {
    const nft = db.nfts[first.nftId]
    if (!nft) return
    if (mode === 'price') updateNft(nft.id, { price: addEth(nft.price, '0.15') })
    else updateNft(nft.id, { editions: [{ id: first.editionId, available: 0 }] })
  }, 1500)
}

/* -------------------------------------------------------------------------- */
/*                                   Pedidos                                  */
/* -------------------------------------------------------------------------- */

export function serializeOrder(order: OrderRecord): Order {
  const {
    idempotencyKey: _k,
    requestHash: _h,
    settleAt: _s,
    outcome: _o,
    quoteId: _q,
    collector: _c,
    ...rest
  } = order
  return rest
}

function txHashFor(orderId: string) {
  let hex = ''
  let h = 0x811c9dc5
  for (let round = 0; hex.length < 64; round++) {
    for (const ch of `${orderId}:${round}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0
    hex += h.toString(16).padStart(8, '0')
  }
  return `0x${hex.slice(0, 64)}`
}

export function createOrder(params: {
  user: UserRecord
  cart: CartRecord
  quoteId: string
  idempotencyKey: string
  requestHash: string
  network: Order['network']
  provider: Order['provider']
  collector: OrderRecord['collector']
}): OrderRecord {
  const serialized = serializeCart(params.cart)
  const now = Date.now()
  const scenario = getScenario()
  const id = nextId('ord')
  const order: OrderRecord = {
    id,
    userId: params.user.id,
    status: 'pending',
    statusReason: null,
    txHash: txHashFor(id),
    explorerUrl: `https://etherscan.io/tx/${txHashFor(id)}`,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    network: params.network,
    provider: params.provider,
    // Snapshot: o recibo não muda mesmo que o catálogo mude depois.
    items: serialized.items.map((i) => ({
      nftId: i.nftId,
      editionId: i.editionId,
      editionLabel: i.editionLabel,
      name: i.name,
      tokenId: i.tokenId,
      image: i.image,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
    })),
    coupon: serialized.coupon,
    totals: serialized.totals,
    version: 1,
    idempotencyKey: params.idempotencyKey,
    requestHash: params.requestHash,
    settleAt: now + scenario.orderSettleMs,
    outcome: scenario.paymentOutcome,
    quoteId: params.quoteId,
    collector: params.collector,
  }
  db.orders[id] = order
  db.idempotency[params.user.id] = { ...db.idempotency[params.user.id], [params.idempotencyKey]: id }
  persist()
  schedule(() => settleOrder(id), scenario.orderSettleMs)
  return order
}

/** Liquida o pedido (confirmado/recusado). Idempotente: estados terminais não mudam. */
export function settleOrder(orderId: string) {
  const order = db.orders[orderId]
  if (!order || order.status !== 'pending') return

  let outcome = order.outcome
  let reason: string | null = outcome === 'rejected' ? 'Pagamento recusado pela carteira.' : null

  if (outcome === 'confirmed') {
    const shortage = order.items.find((item) => {
      const edition = db.nfts[item.nftId]?.editions.find((e) => e.id === item.editionId)
      return !edition || edition.available < item.quantity
    })
    if (shortage) {
      outcome = 'rejected'
      reason = `${shortage.name} (${shortage.editionLabel}) esgotou antes da confirmação.`
    }
  }

  order.status = outcome
  order.statusReason = reason
  order.version += 1
  order.updatedAt = new Date().toISOString()

  if (outcome === 'confirmed') {
    // Remove do carrinho apenas os itens e quantidades comprados.
    const cartId = db.userCarts[order.userId]
    const cart = cartId ? db.carts[cartId] : undefined
    if (cart) {
      for (const item of order.items) {
        const line = cart.items.find((l) => l.nftId === item.nftId && l.editionId === item.editionId)
        if (line) line.quantity -= item.quantity
      }
      cart.items = cart.items.filter((l) => l.quantity > 0)
      if (cart.items.length === 0) cart.couponCode = null
      cart.version += 1
    }
  }
  persist()

  publish({
    id: nextEventId(),
    type: 'order.updated',
    resource: { type: 'order', id: order.id },
    version: order.version,
    occurredAt: order.updatedAt,
    userId: order.userId,
    data: { status: order.status, statusReason: order.statusReason },
  })
  persist()

  if (outcome === 'confirmed') {
    for (const item of order.items) {
      const nft = db.nfts[item.nftId]
      const edition = nft?.editions.find((e) => e.id === item.editionId)
      if (nft && edition) updateNft(nft.id, { editions: [{ id: edition.id, available: edition.available - item.quantity }] })
    }
  }
}

/** Recupera liquidações vencidas (ex.: a página recarregou com pedido pendente). */
export function settleDueOrders() {
  const now = Date.now()
  for (const order of Object.values(db.orders)) {
    if (order.status === 'pending' && order.settleAt <= now) settleOrder(order.id)
    else if (order.status === 'pending') schedule(() => settleOrder(order.id), order.settleAt - now)
  }
}
