/**
 * Funções tipadas por recurso. Cada uma corresponde a um endpoint documentado
 * em `docs/API.md` e valida a resposta com o schema do contrato.
 */
import { z } from 'zod'
import { request, requestVoid } from './client'
import {
  cartSchema,
  favoritesSchema,
  featuredResponseSchema,
  nftDetailSchema,
  nftListResponseSchema,
  orderSchema,
  quoteSchema,
  sessionSchema,
  userSchema,
  walletConnectionSchema,
  walletListSchema,
  walletSchema,
  type AddCartItem,
  type AvatarUpdate,
  type CreateOrder,
  type LoginRequest,
  type NftListQuery,
  type PasswordChange,
  type ProfileUpdate,
  type RegisterRequest,
  type WalletConnectRequest,
  type WalletInput,
  type WalletRole,
} from './contracts'
import { endpoints, headers } from './endpoints'

type Opts = { signal?: AbortSignal }

export const authApi = {
  register: (body: RegisterRequest) => request({ method: 'POST', url: endpoints.auth.register, data: body }, sessionSchema),
  login: (body: LoginRequest) => request({ method: 'POST', url: endpoints.auth.login, data: body }, sessionSchema),
  session: (opts?: Opts) => request({ url: endpoints.auth.session, signal: opts?.signal }, sessionSchema),
  logout: () => requestVoid({ method: 'POST', url: endpoints.auth.logout }),
}

/** Serializa a consulta do catálogo nos parâmetros documentados da API. */
export function nftListParams(query: NftListQuery) {
  return {
    q: query.q || undefined,
    collection: query.collection,
    exclude: query.exclude,
    category: query.categories?.length ? query.categories.join(',') : undefined,
    network: query.networks?.length ? query.networks.join(',') : undefined,
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
    sort: query.sort,
    tab: query.tab,
    page: query.page,
    pageSize: query.pageSize,
  }
}

export const nftApi = {
  list: (query: NftListQuery, opts?: Opts) =>
    request({ url: endpoints.nfts.list, params: nftListParams(query), signal: opts?.signal }, nftListResponseSchema),
  featured: (opts?: Opts) => request({ url: endpoints.nfts.featured, signal: opts?.signal }, featuredResponseSchema),
  detail: (slug: string, opts?: Opts) => request({ url: endpoints.nfts.detail(slug), signal: opts?.signal }, nftDetailSchema),
}

export const favoritesApi = {
  list: (opts?: Opts) => request({ url: endpoints.favorites.list, signal: opts?.signal }, favoritesSchema),
  add: (nftId: string) => request({ method: 'PUT', url: endpoints.favorites.item(nftId) }, favoritesSchema),
  remove: (nftId: string) => request({ method: 'DELETE', url: endpoints.favorites.item(nftId) }, favoritesSchema),
}

export const cartApi = {
  get: (opts?: Opts) => request({ url: endpoints.cart.root, signal: opts?.signal }, cartSchema),
  addItem: (body: AddCartItem) => request({ method: 'POST', url: endpoints.cart.items, data: body }, cartSchema),
  updateItem: (itemId: string, quantity: number) =>
    request({ method: 'PATCH', url: endpoints.cart.item(itemId), data: { quantity } }, cartSchema),
  removeItem: (itemId: string) => request({ method: 'DELETE', url: endpoints.cart.item(itemId) }, cartSchema),
  applyCoupon: (code: string) => request({ method: 'PUT', url: endpoints.cart.coupon, data: { code } }, cartSchema),
  removeCoupon: () => request({ method: 'DELETE', url: endpoints.cart.coupon }, cartSchema),
  acknowledge: () => request({ method: 'POST', url: endpoints.cart.acknowledge }, cartSchema),
}

export const checkoutApi = {
  quote: () => request({ method: 'POST', url: endpoints.quotes }, quoteSchema),
  connectWallet: (body: WalletConnectRequest) =>
    request({ method: 'POST', url: endpoints.walletConnections.create, data: body }, walletConnectionSchema),
  connection: (id: string, opts?: Opts) =>
    request({ url: endpoints.walletConnections.item(id), signal: opts?.signal }, walletConnectionSchema),
  disconnectWallet: (id: string) => requestVoid({ method: 'DELETE', url: endpoints.walletConnections.item(id) }),
}

export const ordersApi = {
  create: (body: CreateOrder, idempotencyKey: string) =>
    request(
      { method: 'POST', url: endpoints.orders.create, data: body, headers: { [headers.idempotencyKey]: idempotencyKey } },
      orderSchema,
    ),
  get: (id: string, opts?: Opts) => request({ url: endpoints.orders.item(id), signal: opts?.signal }, orderSchema),
  pending: (opts?: Opts) =>
    request({ url: endpoints.orders.list, params: { status: 'pending' }, signal: opts?.signal }, z.object({ items: z.array(orderSchema) })),
}

export const profileApi = {
  get: (opts?: Opts) => request({ url: endpoints.profile.root, signal: opts?.signal }, userSchema),
  update: (body: ProfileUpdate) => request({ method: 'PATCH', url: endpoints.profile.root, data: body }, userSchema),
  updateAvatar: (body: AvatarUpdate) => request({ method: 'PUT', url: endpoints.profile.avatar, data: body }, userSchema),
  removeAvatar: () => request({ method: 'DELETE', url: endpoints.profile.avatar }, userSchema),
  changePassword: (body: PasswordChange) => requestVoid({ method: 'POST', url: endpoints.profile.password, data: body }),
}

export const walletsApi = {
  list: (opts?: Opts) => request({ url: endpoints.wallets.list, signal: opts?.signal }, walletListSchema),
  save: (role: WalletRole, body: WalletInput) =>
    request({ method: 'PUT', url: endpoints.wallets.item(role), data: body }, walletSchema),
}
