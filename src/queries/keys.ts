import type { NftListQuery } from '@/api/contracts'

/**
 * Chaves de cache. Tudo que é privado fica sob o prefixo `private` + dono
 * (id do usuário ou do carrinho de visitante): os dados nunca se misturam entre
 * usuários e o logout remove o prefixo inteiro de uma vez.
 */
export const queryKeys = {
  nfts: {
    all: ['nfts'] as const,
    lists: ['nfts', 'list'] as const,
    list: (query: NftListQuery) => ['nfts', 'list', query] as const,
    details: ['nfts', 'detail'] as const,
    detail: (slug: string) => ['nfts', 'detail', slug] as const,
    featured: ['nfts', 'featured'] as const,
  },
  private: {
    all: ['private'] as const,
    owner: (ownerKey: string) => ['private', ownerKey] as const,
    session: (ownerKey: string) => ['private', ownerKey, 'session'] as const,
    cart: (ownerKey: string) => ['private', ownerKey, 'cart'] as const,
    favorites: (userId: string) => ['private', userId, 'favorites'] as const,
    profile: (userId: string) => ['private', userId, 'profile'] as const,
    wallets: (userId: string) => ['private', userId, 'wallets'] as const,
    orders: (userId: string) => ['private', userId, 'orders'] as const,
    order: (userId: string, orderId: string) => ['private', userId, 'orders', orderId] as const,
    pendingOrders: (userId: string) => ['private', userId, 'orders', 'pending'] as const,
    walletConnection: (userId: string, id: string) => ['private', userId, 'wallet-connection', id] as const,
  },
}
