/**
 * Rotas REST. Compartilhadas entre o cliente Axios e os handlers MSW para que
 * ambos os lados falem exatamente o mesmo contrato.
 */
export const API_BASE = import.meta.env.VITE_API_URL ?? '/api'

export const endpoints = {
  auth: {
    register: '/auth/register',
    login: '/auth/login',
    session: '/auth/session',
    logout: '/auth/logout',
  },
  nfts: {
    list: '/nfts',
    featured: '/nfts/featured',
    detail: (slug: string) => `/nfts/${encodeURIComponent(slug)}`,
  },
  favorites: {
    list: '/me/favorites',
    item: (nftId: string) => `/me/favorites/${encodeURIComponent(nftId)}`,
  },
  cart: {
    root: '/cart',
    items: '/cart/items',
    item: (itemId: string) => `/cart/items/${encodeURIComponent(itemId)}`,
    coupon: '/cart/coupon',
    acknowledge: '/cart/acknowledge',
  },
  quotes: '/quotes',
  walletConnections: {
    create: '/wallet-connections',
    item: (id: string) => `/wallet-connections/${encodeURIComponent(id)}`,
  },
  orders: {
    create: '/orders',
    list: '/orders',
    item: (id: string) => `/orders/${encodeURIComponent(id)}`,
  },
  profile: {
    root: '/me/profile',
    avatar: '/me/avatar',
    password: '/me/password',
  },
  wallets: {
    list: '/me/wallets',
    item: (role: string) => `/me/wallets/${encodeURIComponent(role)}`,
  },
  /** Controle da simulação (existe apenas com os mocks ativos). */
  mock: {
    state: '/__mock/state',
    scenario: '/__mock/scenario',
    reset: '/__mock/reset',
    nftUpdate: '/__mock/nft-update',
    replayEvent: '/__mock/replay-event',
    socketDisconnect: '/__mock/socket/disconnect',
    expireSession: '/__mock/expire-session',
  },
} as const

/** Cabeçalhos customizados do contrato. */
export const headers = {
  idempotencyKey: 'Idempotency-Key',
  cartId: 'X-Cart-Id',
} as const
