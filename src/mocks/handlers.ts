/**
 * Handlers REST (MSW). Fazem parsing/validação do contrato e delegam as regras
 * para `logic.ts`. Toda rota de negócio passa por `withNetwork`, que aplica o
 * cenário de rede ativo.
 */
import { http, HttpResponse, delay } from 'msw'
import type { z } from 'zod'
import {
  addCartItemSchema,
  applyCouponSchema,
  avatarUpdateSchema,
  categories,
  createOrderSchema,
  loginRequestSchema,
  networks,
  passwordChangeSchema,
  profileUpdateSchema,
  registerRequestSchema,
  sortOptions,
  catalogTabs,
  updateCartItemSchema,
  walletConnectRequestSchema,
  walletInputSchema,
  walletRoles,
  type Category,
  type Network,
  type NftListQuery,
  type Wallet,
} from '@/api/contracts'
import { API_BASE, endpoints, headers } from '@/api/endpoints'
import { addEth, isEthString } from '@/lib/eth'
import { db, nextId, persist, resetDb } from './db'
import { fail, resetNetworkState, withNetwork } from './http'
import {
  acknowledgeCart,
  createOrder,
  createQuote,
  createSession,
  findCoupon,
  findNftBySlug,
  hashPassword,
  isQuoteCurrent,
  lineLimit,
  listNfts,
  maybeTriggerCheckoutChange,
  mergeGuestCart,
  publicUser,
  readToken,
  requireUser,
  resolveCart,
  serializeCart,
  serializeOrder,
  toSummary,
  updateNft,
} from './logic'
import { connectionCount, disconnectAll, getEventLog, replay, resetRealtime, revokeUser } from './realtime'
import { clearScheduled, getScenario, getScenarioPresets, schedule, setScenarioPresets } from './runtime'
import { scenarioPresets } from './scenarios'
import { HERO_NFT_IDS, SPOTLIGHT_NFT_ID } from './seed'

const api = (path: string) => `${API_BASE}${path}`

async function parseBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    fail('VALIDATION_ERROR', 'Corpo da requisição inválido.')
  }
  const result = schema.safeParse(raw)
  if (!result.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_'
      fieldErrors[key] ??= issue.message
    }
    fail('VALIDATION_ERROR', 'Verifique os campos destacados.', { fieldErrors })
  }
  return result.data
}

function parseList<T extends string>(value: string | null, allowed: readonly T[]): T[] | undefined {
  if (!value) return undefined
  const items = value.split(',').filter((v): v is T => (allowed as readonly string[]).includes(v))
  return items.length ? items : undefined
}

/** Serialização canônica (chaves ordenadas em todos os níveis) para comparar requisições. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function stableHash(value: unknown) {
  const json = canonical(value)
  let h = 0x811c9dc5
  for (let i = 0; i < json.length; i++) h = Math.imul(h ^ json.charCodeAt(i), 16777619) >>> 0
  return h.toString(16)
}

/* -------------------------------------------------------------------------- */

const authHandlers = [
  http.post(
    api(endpoints.auth.register),
    withNetwork('auth', async ({ request }) => {
      const body = await parseBody(request, registerRequestSchema)
      const users = Object.values(db.users)
      const fieldErrors: Record<string, string> = {}
      if (users.some((u) => u.email.toLowerCase() === body.email.toLowerCase())) {
        fieldErrors.email = 'Este e-mail já está cadastrado.'
      }
      if (users.some((u) => u.username.toLowerCase() === body.username.toLowerCase())) {
        fieldErrors.username = 'Este nome de usuário já está em uso.'
      }
      if (fieldErrors.email) fail('EMAIL_TAKEN', 'Já existe uma conta com estes dados.', { fieldErrors })
      if (fieldErrors.username) fail('USERNAME_TAKEN', 'Já existe uma conta com estes dados.', { fieldErrors })

      const id = nextId('usr')
      const salt = `salt_${crypto.randomUUID()}`
      db.users[id] = {
        id,
        email: body.email,
        username: body.username,
        displayName: body.username,
        ensName: body.username.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        walletNickname: 'Principal',
        avatarUrl: null,
        updatedAt: new Date().toISOString(),
        salt,
        passwordHash: await hashPassword(salt, body.password),
      }
      db.favorites[id] = []
      db.wallets[id] = []
      mergeGuestCart(request.headers.get(headers.cartId), id)
      const session = createSession(id)
      return HttpResponse.json(
        { token: session.token, expiresAt: new Date(session.expiresAt).toISOString(), user: publicUser(db.users[id]!) },
        { status: 201 },
      )
    }),
  ),

  http.post(
    api(endpoints.auth.login),
    withNetwork('auth', async ({ request }) => {
      const body = await parseBody(request, loginRequestSchema)
      const user = Object.values(db.users).find((u) => u.email.toLowerCase() === body.email.toLowerCase())
      const hash = user ? await hashPassword(user.salt, body.password) : null
      if (!user || hash !== user.passwordHash) {
        fail('INVALID_CREDENTIALS', 'E-mail ou senha incorretos.')
      }
      mergeGuestCart(request.headers.get(headers.cartId), user.id)
      const session = createSession(user.id)
      return HttpResponse.json({
        token: session.token,
        expiresAt: new Date(session.expiresAt).toISOString(),
        user: publicUser(user),
      })
    }),
  ),

  http.get(
    api(endpoints.auth.session),
    withNetwork('auth', ({ request }) => {
      const user = requireUser(request)
      const session = db.sessions[readToken(request)!]!
      return HttpResponse.json({
        token: session.token,
        expiresAt: new Date(session.expiresAt).toISOString(),
        user: publicUser(user),
      })
    }),
  ),

  http.post(
    api(endpoints.auth.logout),
    withNetwork('auth', ({ request }) => {
      const token = readToken(request)
      const session = token ? db.sessions[token] : undefined
      if (token && session) {
        delete db.sessions[token]
        revokeUser(session.userId)
        persist()
      }
      return new HttpResponse(null, { status: 204 })
    }),
  ),
]

/* -------------------------------------------------------------------------- */

const catalogHandlers = [
  http.get(
    api(endpoints.nfts.featured),
    withNetwork('nfts.featured', () => {
      const hero = HERO_NFT_IDS.map((id) => db.nfts[id]).filter((n) => n !== undefined)
      const spotlight = db.nfts[SPOTLIGHT_NFT_ID]!
      return HttpResponse.json({ hero: hero.map(toSummary), spotlight: toSummary(spotlight) })
    }),
  ),

  http.get(
    api(endpoints.nfts.list),
    withNetwork('nfts.list', ({ request }) => {
      const params = new URL(request.url).searchParams
      const num = (key: string) => {
        const v = Number(params.get(key))
        return Number.isInteger(v) && v > 0 ? v : undefined
      }
      const eth = (key: string) => {
        const v = params.get(key)
        return v && isEthString(v) ? v : undefined
      }
      const query: NftListQuery = {
        q: params.get('q') ?? undefined,
        collection: params.get('collection') ?? undefined,
        exclude: params.get('exclude') ?? undefined,
        categories: parseList<Category>(params.get('category'), categories),
        networks: parseList<Network>(params.get('network'), networks),
        minPrice: eth('minPrice'),
        maxPrice: eth('maxPrice'),
        sort: parseList(params.get('sort'), sortOptions)?.[0],
        tab: parseList(params.get('tab'), catalogTabs)?.[0],
        page: num('page'),
        pageSize: Math.min(num('pageSize') ?? 9, 48),
      }
      return HttpResponse.json(listNfts(query))
    }),
  ),

  http.get(
    api('/nfts/:slug'),
    withNetwork('nfts.detail', ({ params }) => {
      const nft = findNftBySlug(String(params.slug))
      if (!nft) fail('NOT_FOUND', 'NFT não encontrado.')
      return HttpResponse.json(nft)
    }),
  ),
]

/* -------------------------------------------------------------------------- */

const favoriteHandlers = [
  http.get(
    api(endpoints.favorites.list),
    withNetwork('favorites.read', ({ request }) => {
      const user = requireUser(request)
      return HttpResponse.json({ nftIds: db.favorites[user.id] ?? [] })
    }),
  ),
  http.put(
    api('/me/favorites/:nftId'),
    withNetwork('favorites.write', ({ request, params }) => {
      const user = requireUser(request)
      const nftId = String(params.nftId)
      if (!db.nfts[nftId]) fail('NOT_FOUND', 'NFT não encontrado.')
      const list = new Set(db.favorites[user.id] ?? [])
      list.add(nftId)
      db.favorites[user.id] = [...list]
      persist()
      return HttpResponse.json({ nftIds: db.favorites[user.id] })
    }),
  ),
  http.delete(
    api('/me/favorites/:nftId'),
    withNetwork('favorites.write', ({ request, params }) => {
      const user = requireUser(request)
      db.favorites[user.id] = (db.favorites[user.id] ?? []).filter((id) => id !== params.nftId)
      persist()
      return HttpResponse.json({ nftIds: db.favorites[user.id] })
    }),
  ),
]

/* -------------------------------------------------------------------------- */

const cartHandlers = [
  http.get(
    api(endpoints.cart.root),
    withNetwork('cart.read', ({ request }) => HttpResponse.json(serializeCart(resolveCart(request)))),
  ),

  http.post(
    api(endpoints.cart.items),
    withNetwork('cart.write', async ({ request }) => {
      const cart = resolveCart(request)
      const body = await parseBody(request, addCartItemSchema)
      const nft = db.nfts[body.nftId]
      const edition = nft?.editions.find((e) => e.id === body.editionId)
      if (!nft || !edition) fail('NOT_FOUND', 'NFT ou edição não encontrados.')
      if (edition.available === 0) fail('EDITION_UNAVAILABLE', `A edição ${edition.label} está esgotada.`)
      const existing = cart.items.find((l) => l.nftId === body.nftId && l.editionId === body.editionId)
      const desired = (existing?.quantity ?? 0) + body.quantity
      const limit = lineLimit(nft.id, edition.id)
      if (desired > limit) {
        fail('AVAILABILITY_CONFLICT', `Você pode ter no máximo ${limit} unidade(s) da edição ${edition.label}.`, {
          details: { available: edition.available, limit, inCart: existing?.quantity ?? 0 },
        })
      }
      if (existing) {
        existing.quantity = desired
        existing.acknowledgedUnitPrice = nft.price
      } else {
        cart.items.push({ id: nextId('line'), nftId: nft.id, editionId: edition.id, quantity: body.quantity, acknowledgedUnitPrice: nft.price })
      }
      cart.version += 1
      persist()
      return HttpResponse.json(serializeCart(cart), { status: 201 })
    }),
  ),

  http.patch(
    api('/cart/items/:itemId'),
    withNetwork('cart.write', async ({ request, params }) => {
      const cart = resolveCart(request)
      const body = await parseBody(request, updateCartItemSchema)
      const line = cart.items.find((l) => l.id === params.itemId)
      if (!line) fail('NOT_FOUND', 'Item não está no carrinho.')
      const limit = lineLimit(line.nftId, line.editionId)
      if (body.quantity > limit) {
        fail('AVAILABILITY_CONFLICT', `Quantidade máxima disponível: ${limit}.`, { details: { limit } })
      }
      line.quantity = body.quantity
      cart.version += 1
      persist()
      return HttpResponse.json(serializeCart(cart))
    }),
  ),

  http.delete(
    api('/cart/items/:itemId'),
    withNetwork('cart.write', ({ request, params }) => {
      const cart = resolveCart(request)
      cart.items = cart.items.filter((l) => l.id !== params.itemId)
      if (cart.items.length === 0) cart.couponCode = null
      cart.version += 1
      persist()
      return HttpResponse.json(serializeCart(cart))
    }),
  ),

  http.put(
    api(endpoints.cart.coupon),
    withNetwork('cart.write', async ({ request }) => {
      const cart = resolveCart(request)
      const body = await parseBody(request, applyCouponSchema)
      const coupon = findCoupon(body.code)
      if (!coupon) fail('COUPON_INVALID', 'Código promocional inválido.', { fieldErrors: { code: 'Código promocional inválido.' } })
      if (coupon.expiresAt && Date.parse(coupon.expiresAt) < Date.now()) {
        fail('COUPON_EXPIRED', 'Este código promocional expirou.', { fieldErrors: { code: 'Este código promocional expirou.' } })
      }
      cart.couponCode = coupon.code
      cart.version += 1
      persist()
      return HttpResponse.json(serializeCart(cart))
    }),
  ),

  http.delete(
    api(endpoints.cart.coupon),
    withNetwork('cart.write', ({ request }) => {
      const cart = resolveCart(request)
      cart.couponCode = null
      cart.version += 1
      persist()
      return HttpResponse.json(serializeCart(cart))
    }),
  ),

  http.post(
    api(endpoints.cart.acknowledge),
    withNetwork('cart.write', ({ request }) => {
      const cart = resolveCart(request)
      acknowledgeCart(cart)
      return HttpResponse.json(serializeCart(cart))
    }),
  ),
]

/* -------------------------------------------------------------------------- */

const checkoutHandlers = [
  http.post(
    api(endpoints.quotes),
    withNetwork('quotes', ({ request }) => {
      const user = requireUser(request)
      const cart = resolveCart(request)
      const quote = createQuote(cart, user.id)
      if (quote.valid) maybeTriggerCheckoutChange(cart)
      return HttpResponse.json(quote, { status: 201 })
    }),
  ),

  http.post(
    api(endpoints.walletConnections.create),
    withNetwork('wallet-connections', async ({ request }) => {
      const user = requireUser(request)
      const body = await parseBody(request, walletConnectRequestSchema)
      const wallet = (db.wallets[user.id] ?? []).find((w) => w.id === body.walletId)
      if (!wallet && body.walletId !== 'external') fail('NOT_FOUND', 'Carteira não encontrada.')
      if (getScenario().walletOutcome === 'rejected') {
        fail('WALLET_REJECTED', 'A conexão foi recusada na carteira. Aprove a solicitação para continuar.')
      }
      const id = nextId('conn')
      const disconnectAfter = getScenario().walletDisconnectAfterMs
      db.walletConnections[id] = {
        id,
        userId: user.id,
        walletId: body.walletId,
        provider: body.provider,
        network: body.network,
        status: 'connected',
        address: wallet?.address ?? '0x0000000000000000000000000000000000000000',
        disconnectAt: disconnectAfter ? Date.now() + disconnectAfter : null,
      }
      persist()
      if (disconnectAfter) {
        schedule(() => {
          const conn = db.walletConnections[id]
          if (conn) {
            conn.status = 'disconnected'
            persist()
          }
        }, disconnectAfter)
      }
      const { userId: _u, disconnectAt: _d, ...connection } = db.walletConnections[id]!
      return HttpResponse.json(connection, { status: 201 })
    }),
  ),

  http.get(
    api('/wallet-connections/:id'),
    withNetwork('wallet-connections', ({ request, params }) => {
      const user = requireUser(request)
      const conn = db.walletConnections[String(params.id)]
      if (!conn || conn.userId !== user.id) fail('NOT_FOUND', 'Conexão não encontrada.')
      if (conn.disconnectAt && conn.disconnectAt <= Date.now()) conn.status = 'disconnected'
      const { userId: _u, disconnectAt: _d, ...connection } = conn
      return HttpResponse.json(connection)
    }),
  ),

  http.delete(
    api('/wallet-connections/:id'),
    withNetwork('wallet-connections', ({ request, params }) => {
      const user = requireUser(request)
      const conn = db.walletConnections[String(params.id)]
      if (conn && conn.userId === user.id) {
        conn.status = 'disconnected'
        persist()
      }
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  http.post(
    api(endpoints.orders.create),
    withNetwork('orders.create', async ({ request }) => {
      const user = requireUser(request)
      const key = request.headers.get(headers.idempotencyKey)
      if (!key || key.length < 8) fail('VALIDATION_ERROR', 'Cabeçalho Idempotency-Key obrigatório.')
      const body = await parseBody(request, createOrderSchema)
      const requestHash = stableHash(body)

      // Mesma chave: devolve o mesmo pedido; conteúdo diferente gera conflito.
      const existingId = db.idempotency[user.id]?.[key]
      if (existingId) {
        const existing = db.orders[existingId]!
        if (existing.requestHash !== requestHash) {
          fail('IDEMPOTENCY_CONFLICT', 'Esta chave de idempotência já foi usada com outro conteúdo.')
        }
        return HttpResponse.json(serializeOrder(existing), { status: 200 })
      }

      const cart = resolveCart(request)
      if (!isQuoteCurrent(body.quoteId, cart)) {
        fail('QUOTE_OUTDATED', 'Preço, disponibilidade, cupom ou taxas mudaram. Revise e confirme novamente.', {
          details: { quote: createQuote(cart, user.id), cart: serializeCart(cart) },
        })
      }
      const connection = db.walletConnections[body.connectionId]
      if (connection?.disconnectAt && connection.disconnectAt <= Date.now()) connection.status = 'disconnected'
      if (!connection || connection.userId !== user.id || connection.status !== 'connected') {
        fail('WALLET_DISCONNECTED', 'A carteira foi desconectada. Conecte novamente para concluir.')
      }

      const order = createOrder({
        user,
        cart,
        quoteId: body.quoteId,
        idempotencyKey: key,
        requestHash,
        network: connection.network,
        provider: connection.provider,
        collector: body.collector,
      })

      // Cenário de timeout: o pedido já existe, mas a resposta chega tarde.
      const responseDelay = getScenario().orderResponseDelayMs
      if (responseDelay > 0) await delay(responseDelay)
      return HttpResponse.json(serializeOrder(order), { status: 201 })
    }),
  ),

  http.get(
    api(endpoints.orders.list),
    withNetwork('orders.read', ({ request }) => {
      const user = requireUser(request)
      const status = new URL(request.url).searchParams.get('status')
      const items = Object.values(db.orders)
        .filter((o) => o.userId === user.id && (!status || o.status === status))
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .map(serializeOrder)
      return HttpResponse.json({ items })
    }),
  ),

  http.get(
    api('/orders/:id'),
    withNetwork('orders.read', ({ request, params }) => {
      const user = requireUser(request)
      const order = db.orders[String(params.id)]
      if (!order) fail('NOT_FOUND', 'Pedido não encontrado.')
      if (order.userId !== user.id) fail('FORBIDDEN', 'Você não tem permissão para ver este pedido.')
      return HttpResponse.json(serializeOrder(order))
    }),
  ),
]

/* -------------------------------------------------------------------------- */

const accountHandlers = [
  http.get(
    api(endpoints.profile.root),
    withNetwork('profile', ({ request }) => HttpResponse.json(publicUser(requireUser(request)))),
  ),

  http.patch(
    api(endpoints.profile.root),
    withNetwork('profile', async ({ request }) => {
      const user = requireUser(request)
      const body = await parseBody(request, profileUpdateSchema)
      const others = Object.values(db.users).filter((u) => u.id !== user.id)
      if (others.some((u) => u.email.toLowerCase() === body.email.toLowerCase())) {
        fail('EMAIL_TAKEN', 'Já existe uma conta com este e-mail.', { fieldErrors: { email: 'Este e-mail já está cadastrado.' } })
      }
      if (others.some((u) => u.username.toLowerCase() === body.username.toLowerCase())) {
        fail('USERNAME_TAKEN', 'Nome de usuário indisponível.', { fieldErrors: { username: 'Este nome de usuário já está em uso.' } })
      }
      Object.assign(user, body, { updatedAt: new Date().toISOString() })
      persist()
      return HttpResponse.json(publicUser(user))
    }),
  ),

  http.put(
    api(endpoints.profile.avatar),
    withNetwork('profile', async ({ request }) => {
      const user = requireUser(request)
      const body = await parseBody(request, avatarUpdateSchema)
      if (body.dataUrl.length > 400_000) {
        fail('VALIDATION_ERROR', 'A imagem deve ter no máximo 300 KB.', { fieldErrors: { dataUrl: 'A imagem deve ter no máximo 300 KB.' } })
      }
      user.avatarUrl = body.dataUrl
      user.updatedAt = new Date().toISOString()
      persist()
      return HttpResponse.json(publicUser(user))
    }),
  ),

  http.delete(
    api(endpoints.profile.avatar),
    withNetwork('profile', ({ request }) => {
      const user = requireUser(request)
      user.avatarUrl = null
      user.updatedAt = new Date().toISOString()
      persist()
      return HttpResponse.json(publicUser(user))
    }),
  ),

  http.post(
    api(endpoints.profile.password),
    withNetwork('profile', async ({ request }) => {
      const user = requireUser(request)
      const body = await parseBody(request, passwordChangeSchema)
      if ((await hashPassword(user.salt, body.currentPassword)) !== user.passwordHash) {
        fail('VALIDATION_ERROR', 'Senha atual incorreta.', { fieldErrors: { currentPassword: 'Senha atual incorreta.' } })
      }
      if (body.currentPassword === body.newPassword) {
        fail('VALIDATION_ERROR', 'A nova senha deve ser diferente da atual.', { fieldErrors: { newPassword: 'A nova senha deve ser diferente da atual.' } })
      }
      user.salt = `salt_${crypto.randomUUID()}`
      user.passwordHash = await hashPassword(user.salt, body.newPassword)
      user.updatedAt = new Date().toISOString()
      persist()
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  http.get(
    api(endpoints.wallets.list),
    withNetwork('wallets', ({ request }) => {
      const user = requireUser(request)
      return HttpResponse.json({ items: db.wallets[user.id] ?? [] })
    }),
  ),

  http.put(
    api('/me/wallets/:role'),
    withNetwork('wallets', async ({ request, params }) => {
      const user = requireUser(request)
      const role = walletRoles.find((r) => r === params.role)
      if (!role) fail('NOT_FOUND', 'Tipo de carteira inexistente.')
      const body = await parseBody(request, walletInputSchema)
      const list = db.wallets[user.id] ?? []
      if (role === 'secondary' && !list.some((w) => w.role === 'primary')) {
        fail('VALIDATION_ERROR', 'Cadastre a carteira principal antes da secundária.')
      }
      const other = list.find((w) => w.role !== role)
      if (other && other.address.toLowerCase() === body.address.toLowerCase()) {
        fail('VALIDATION_ERROR', 'Verifique os campos destacados.', {
          fieldErrors: { address: `Este endereço já está na carteira ${other.role === 'primary' ? 'principal' : 'secundária'}.` },
        })
      }
      const current = list.find((w) => w.role === role)
      const wallet: Wallet = {
        ...body,
        secondaryAddress: body.secondaryAddress ?? '',
        id: current?.id ?? nextId('wal'),
        role,
        updatedAt: new Date().toISOString(),
      }
      db.wallets[user.id] = [...list.filter((w) => w.role !== role), wallet].sort((a) => (a.role === 'primary' ? -1 : 1))
      persist()
      return HttpResponse.json(wallet, { status: current ? 200 : 201 })
    }),
  ),
]

/* -------------------------------------------------------------------------- */
/*                   Controle da simulação (sem latência/falhas)              */
/* -------------------------------------------------------------------------- */

export function resetSimulation(presets: string[] = []) {
  clearScheduled()
  resetNetworkState()
  resetRealtime()
  resetDb()
  setScenarioPresets(presets)
  disconnectAll(0)
}

const mockControlHandlers = [
  http.get(api(endpoints.mock.state), () =>
    HttpResponse.json({
      presets: getScenarioPresets(),
      available: scenarioPresets,
      scenario: getScenario(),
      sockets: connectionCount(),
      events: getEventLog().slice(-20),
    }),
  ),

  http.put(api(endpoints.mock.scenario), async ({ request }) => {
    const body = (await request.json()) as { presets?: string[] }
    setScenarioPresets((body.presets ?? []).filter((id) => scenarioPresets.some((p) => p.id === id)))
    return HttpResponse.json({ presets: getScenarioPresets(), scenario: getScenario() })
  }),

  http.post(api(endpoints.mock.reset), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { presets?: string[] }
    resetSimulation(body.presets ?? [])
    return HttpResponse.json({ ok: true, presets: getScenarioPresets() })
  }),

  http.post(api(endpoints.mock.nftUpdate), async ({ request }) => {
    const body = (await request.json()) as {
      nftId?: string
      slug?: string
      /** Usa o primeiro item do carrinho de quem fez a requisição. */
      fromCart?: boolean
      price?: string
      priceDelta?: string
      soldOut?: boolean
      editions?: { id: string; available: number }[]
    }
    let nft = body.nftId ? db.nfts[body.nftId] : body.slug ? findNftBySlug(body.slug) : null
    let editions = body.editions
    if (body.fromCart) {
      const line = resolveCart(request).items[0]
      nft = line ? db.nfts[line.nftId] : null
      if (line && body.soldOut) editions = [{ id: line.editionId, available: 0 }]
    }
    if (!nft) return HttpResponse.json({ error: 'NFT não encontrado' }, { status: 404 })
    const price = body.price ?? (body.priceDelta ? addEth(nft.price, body.priceDelta) : undefined)
    const event = updateNft(nft.id, { price, editions })
    return HttpResponse.json({ event })
  }),

  http.post(api(endpoints.mock.replayEvent), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { eventId?: string; mode?: 'last' | 'stale' }
    const event = replay(body.eventId, body.mode)
    return HttpResponse.json({ event })
  }),

  http.post(api(endpoints.mock.socketDisconnect), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { blockMs?: number }
    disconnectAll(body.blockMs ?? 0)
    return HttpResponse.json({ ok: true })
  }),

  http.post(api(endpoints.mock.expireSession), () => {
    for (const session of Object.values(db.sessions)) session.expiresAt = Date.now() - 1
    persist()
    return HttpResponse.json({ ok: true })
  }),
]

export const restHandlers = [
  ...mockControlHandlers,
  ...authHandlers,
  ...catalogHandlers,
  ...favoriteHandlers,
  ...cartHandlers,
  ...checkoutHandlers,
  ...accountHandlers,
]
