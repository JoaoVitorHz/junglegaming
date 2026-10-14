/**
 * Contratos REST e de eventos da aplicação.
 *
 * Fonte única de verdade para transporte (Axios), mocks (MSW) e interface.
 * As respostas são validadas com zod na borda de rede (ver `src/api/client.ts`),
 * então um contrato quebrado vira erro explícito em vez de `undefined` na UI.
 *
 * Valores monetários são strings decimais em ETH; quantidades são inteiros.
 */
import { z } from 'zod'
import { isEthString } from '@/lib/eth'

export const ethAmount = z.string().refine(isEthString, 'Valor ETH inválido')

/* -------------------------------------------------------------------------- */
/*                                   Erros                                    */
/* -------------------------------------------------------------------------- */

export const apiErrorCodes = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'SESSION_EXPIRED',
  'INVALID_CREDENTIALS',
  'FORBIDDEN',
  'NOT_FOUND',
  'EMAIL_TAKEN',
  'USERNAME_TAKEN',
  'AVAILABILITY_CONFLICT',
  'EDITION_UNAVAILABLE',
  'QUOTE_OUTDATED',
  'IDEMPOTENCY_CONFLICT',
  'COUPON_INVALID',
  'COUPON_EXPIRED',
  'WALLET_REJECTED',
  'WALLET_DISCONNECTED',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const
export type ApiErrorCode = (typeof apiErrorCodes)[number]

export const apiErrorBody = z.object({
  error: z.object({
    code: z.enum(apiErrorCodes),
    message: z.string(),
    fieldErrors: z.record(z.string(), z.string()).optional(),
    details: z.unknown().optional(),
  }),
})
export type ApiErrorBody = z.infer<typeof apiErrorBody>

/* -------------------------------------------------------------------------- */
/*                                    NFTs                                    */
/* -------------------------------------------------------------------------- */

export const categories = [
  'arte-digital',
  'fotografia',
  'musica',
  'arte-3d',
  'colecionaveis',
  'generativa',
  'jogos',
  'assinaturas',
  'utilidade',
] as const
export type Category = (typeof categories)[number]

export const networks = ['ethereum', 'polygon', 'solana'] as const
export type Network = (typeof networks)[number]

export const sortOptions = ['recent', 'price-asc', 'price-desc', 'popular'] as const
export type SortOption = (typeof sortOptions)[number]

export const catalogTabs = ['all', 'new', 'trending'] as const
export type CatalogTab = (typeof catalogTabs)[number]

export const editionSchema = z.object({
  id: z.string(),
  label: z.string(),
  supply: z.number().int().nullable(),
  available: z.number().int().nonnegative(),
})
export type Edition = z.infer<typeof editionSchema>

export const nftImageSchema = z.object({
  key: z.string(),
  alt: z.string(),
})

export const nftSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  tokenId: z.string(),
  collection: z.string(),
  category: z.enum(categories),
  network: z.enum(networks),
  image: nftImageSchema,
  price: ethAmount,
  compareAtPrice: ethAmount.nullable(),
  rarity: z.enum(['comum', 'raro', 'lendario']),
  rating: z.number(),
  reviewCount: z.number().int(),
  totalAvailable: z.number().int().nonnegative(),
  createdAt: z.string(),
  version: z.number().int(),
})
export type NftSummary = z.infer<typeof nftSummarySchema>

export const nftDetailSchema = nftSummarySchema.extend({
  description: z.string(),
  longDescription: z.array(z.string()),
  attributes: z.array(z.string()),
  contract: z.string(),
  royaltyPercent: z.number(),
  gallery: z.array(nftImageSchema),
  editions: z.array(editionSchema),
  maxPerOrder: z.number().int().positive(),
})
export type NftDetail = z.infer<typeof nftDetailSchema>

export const nftListQuerySchema = z.object({
  q: z.string().optional(),
  collection: z.string().optional(),
  exclude: z.string().optional(),
  categories: z.array(z.enum(categories)).optional(),
  networks: z.array(z.enum(networks)).optional(),
  minPrice: ethAmount.optional(),
  maxPrice: ethAmount.optional(),
  sort: z.enum(sortOptions).optional(),
  tab: z.enum(catalogTabs).optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(48).optional(),
})
export type NftListQuery = z.infer<typeof nftListQuerySchema>

export const facetCountSchema = z.object({ value: z.string(), count: z.number().int() })

export const nftListResponseSchema = z.object({
  items: z.array(nftSummarySchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
  facets: z.object({
    categories: z.array(facetCountSchema),
    networks: z.array(facetCountSchema),
    priceRange: z.object({ min: ethAmount, max: ethAmount }),
  }),
})
export type NftListResponse = z.infer<typeof nftListResponseSchema>

export const featuredResponseSchema = z.object({
  hero: z.array(nftSummarySchema),
  spotlight: nftSummarySchema,
})
export type FeaturedResponse = z.infer<typeof featuredResponseSchema>

/* -------------------------------------------------------------------------- */
/*                               Sessão e conta                               */
/* -------------------------------------------------------------------------- */

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  username: z.string(),
  displayName: z.string(),
  ensName: z.string(),
  walletNickname: z.string(),
  avatarUrl: z.string().nullable(),
  updatedAt: z.string(),
})
export type User = z.infer<typeof userSchema>

export const sessionSchema = z.object({
  token: z.string(),
  expiresAt: z.string(),
  user: userSchema,
})
export type Session = z.infer<typeof sessionSchema>

export const loginRequestSchema = z.object({
  email: z.email('Informe um e-mail válido'),
  password: z.string().min(1, 'Informe sua senha'),
})
export type LoginRequest = z.infer<typeof loginRequestSchema>

export const passwordRule = z
  .string()
  .min(8, 'A senha deve ter pelo menos 8 caracteres')
  .regex(/[A-Za-z]/, 'A senha deve conter letras')
  .regex(/\d/, 'A senha deve conter números')

export const usernameRule = z
  .string()
  .trim()
  .min(3, 'Use pelo menos 3 caracteres')
  .max(24, 'Use no máximo 24 caracteres')
  .regex(/^[a-z0-9_.]+$/i, 'Use apenas letras, números, ponto ou sublinhado')

export const registerRequestSchema = z.object({
  username: usernameRule,
  email: z.email('Informe um e-mail válido'),
  password: passwordRule,
})
export type RegisterRequest = z.infer<typeof registerRequestSchema>

/* -------------------------------------------------------------------------- */
/*                                   Perfil                                   */
/* -------------------------------------------------------------------------- */

export const ensLabelRule = z
  .string()
  .trim()
  .min(3, 'Use pelo menos 3 caracteres')
  .regex(/^[a-z0-9-]+$/, 'Use letras minúsculas, números ou hífen')

export const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(2, 'Informe o nome de exibição').max(40, 'Use no máximo 40 caracteres'),
  username: usernameRule,
  email: z.email('Informe um e-mail válido'),
  ensName: ensLabelRule,
  walletNickname: z.string().trim().min(2, 'Informe o apelido da carteira').max(32, 'Use no máximo 32 caracteres'),
})
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>

export const avatarUpdateSchema = z.object({
  dataUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|webp);base64,/, 'Envie uma imagem PNG, JPG ou WebP'),
})
export type AvatarUpdate = z.infer<typeof avatarUpdateSchema>

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual'),
  newPassword: passwordRule,
})
export type PasswordChange = z.infer<typeof passwordChangeSchema>

/* -------------------------------------------------------------------------- */
/*                                  Carteiras                                 */
/* -------------------------------------------------------------------------- */

export const walletProviders = ['metamask', 'walletconnect', 'coinbase'] as const
export type WalletProvider = (typeof walletProviders)[number]

export const walletRoles = ['primary', 'secondary'] as const
export type WalletRole = (typeof walletRoles)[number]

export const walletAddressRule = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Informe um endereço 0x com 40 caracteres hexadecimais')

export const walletInputSchema = z.object({
  displayName: z.string().trim().min(2, 'Informe o nome de exibição'),
  nickname: z.string().trim().min(2, 'Informe o apelido da carteira'),
  network: z.enum(networks, 'Selecione uma rede'),
  profileName: z.string().trim().min(2, 'Informe o nome do perfil'),
  address: walletAddressRule,
  secondaryAddress: z.string().trim().optional(),
  provider: z.enum(walletProviders, 'Selecione uma carteira'),
  referralCode: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]{4,12}$/i, 'Use de 4 a 12 letras ou números'),
  email: z.email('Informe um e-mail válido'),
  ensName: ensLabelRule,
})
export type WalletInput = z.infer<typeof walletInputSchema>

export const walletSchema = walletInputSchema.extend({
  id: z.string(),
  role: z.enum(walletRoles),
  secondaryAddress: z.string(),
  updatedAt: z.string(),
})
export type Wallet = z.infer<typeof walletSchema>

export const walletListSchema = z.object({ items: z.array(walletSchema) })

export const walletConnectRequestSchema = z.object({
  walletId: z.string(),
  provider: z.enum(walletProviders),
  network: z.enum(networks),
})
export type WalletConnectRequest = z.infer<typeof walletConnectRequestSchema>

export const walletConnectionSchema = z.object({
  id: z.string(),
  walletId: z.string(),
  provider: z.enum(walletProviders),
  network: z.enum(networks),
  status: z.enum(['connected', 'disconnected']),
  address: z.string(),
})
export type WalletConnection = z.infer<typeof walletConnectionSchema>

/* -------------------------------------------------------------------------- */
/*                                 Favoritos                                  */
/* -------------------------------------------------------------------------- */

export const favoritesSchema = z.object({ nftIds: z.array(z.string()) })
export type Favorites = z.infer<typeof favoritesSchema>

/* -------------------------------------------------------------------------- */
/*                              Carrinho e cotação                            */
/* -------------------------------------------------------------------------- */

export const lineStatusSchema = z.enum(['ok', 'price_changed', 'insufficient', 'unavailable'])
export type LineStatus = z.infer<typeof lineStatusSchema>

export const cartItemSchema = z.object({
  id: z.string(),
  nftId: z.string(),
  editionId: z.string(),
  editionLabel: z.string(),
  name: z.string(),
  tokenId: z.string(),
  image: nftImageSchema,
  quantity: z.number().int().positive(),
  unitPrice: ethAmount,
  /** Preço observado quando o item foi adicionado/confirmado pela última vez. */
  acknowledgedUnitPrice: ethAmount,
  lineTotal: ethAmount,
  available: z.number().int().nonnegative(),
  maxPerOrder: z.number().int().positive(),
  status: lineStatusSchema,
  nftVersion: z.number().int(),
})
export type CartItem = z.infer<typeof cartItemSchema>

export const couponSchema = z.object({
  code: z.string(),
  percentOff: z.number(),
  description: z.string(),
})

export const totalsSchema = z.object({
  subtotal: ethAmount,
  discount: ethAmount,
  networkFee: ethAmount,
  total: ethAmount,
})
export type Totals = z.infer<typeof totalsSchema>

export const cartSchema = z.object({
  id: z.string(),
  ownerType: z.enum(['guest', 'user']),
  items: z.array(cartItemSchema),
  coupon: couponSchema.nullable(),
  totals: totalsSchema,
  itemCount: z.number().int(),
  hasChanges: z.boolean(),
  version: z.number().int(),
})
export type Cart = z.infer<typeof cartSchema>

export const addCartItemSchema = z.object({
  nftId: z.string(),
  editionId: z.string(),
  quantity: z.number().int().positive(),
})
export type AddCartItem = z.infer<typeof addCartItemSchema>

export const updateCartItemSchema = z.object({ quantity: z.number().int().positive() })

export const applyCouponSchema = z.object({ code: z.string().trim().min(1, 'Informe um código') })

export const quoteSchema = z.object({
  id: z.string(),
  cartVersion: z.number().int(),
  items: z.array(
    z.object({
      nftId: z.string(),
      editionId: z.string(),
      name: z.string(),
      tokenId: z.string(),
      image: nftImageSchema,
      quantity: z.number().int().positive(),
      unitPrice: ethAmount,
      lineTotal: ethAmount,
      status: lineStatusSchema,
    }),
  ),
  coupon: couponSchema.nullable(),
  totals: totalsSchema,
  valid: z.boolean(),
  issues: z.array(z.string()),
  expiresAt: z.string(),
})
export type Quote = z.infer<typeof quoteSchema>

/* -------------------------------------------------------------------------- */
/*                                   Pedidos                                  */
/* -------------------------------------------------------------------------- */

export const orderStatuses = ['pending', 'confirmed', 'rejected'] as const
export type OrderStatus = (typeof orderStatuses)[number]

export const collectorDetailsSchema = z.object({
  displayName: z.string().trim().min(2, 'Informe o nome de exibição'),
  username: usernameRule,
  network: z.enum(networks, 'Selecione uma rede'),
  profileName: z.string().trim().min(2, 'Informe o nome do perfil'),
  walletAddress: walletAddressRule,
  secondaryAddress: z.string().trim().optional(),
  provider: z.enum(walletProviders, 'Selecione uma carteira'),
  referralCode: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]{4,12}$/i, 'Use de 4 a 12 letras ou números'),
  email: z.email('Informe um e-mail válido'),
  ensName: ensLabelRule,
  note: z.string().max(280, 'Use no máximo 280 caracteres').optional(),
})
export type CollectorDetails = z.infer<typeof collectorDetailsSchema>

export const createOrderSchema = z.object({
  quoteId: z.string(),
  walletId: z.string().nullable(),
  connectionId: z.string(),
  collector: collectorDetailsSchema,
})
export type CreateOrder = z.infer<typeof createOrderSchema>

export const orderSchema = z.object({
  id: z.string(),
  userId: z.string(),
  status: z.enum(orderStatuses),
  statusReason: z.string().nullable(),
  txHash: z.string(),
  explorerUrl: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  network: z.enum(networks),
  provider: z.enum(walletProviders),
  items: z.array(
    z.object({
      nftId: z.string(),
      editionId: z.string(),
      editionLabel: z.string(),
      name: z.string(),
      tokenId: z.string(),
      image: nftImageSchema,
      quantity: z.number().int().positive(),
      unitPrice: ethAmount,
      lineTotal: ethAmount,
    }),
  ),
  coupon: couponSchema.nullable(),
  totals: totalsSchema,
  version: z.number().int(),
})
export type Order = z.infer<typeof orderSchema>

/* -------------------------------------------------------------------------- */
/*                              Eventos (Socket.IO)                           */
/* -------------------------------------------------------------------------- */

export const nftUpdatedEventSchema = z.object({
  id: z.string(),
  type: z.literal('nft.updated'),
  resource: z.object({ type: z.literal('nft'), id: z.string() }),
  version: z.number().int(),
  occurredAt: z.string(),
  data: z.object({
    price: ethAmount,
    editions: z.array(z.object({ id: z.string(), available: z.number().int().nonnegative() })),
  }),
})
export type NftUpdatedEvent = z.infer<typeof nftUpdatedEventSchema>

export const orderUpdatedEventSchema = z.object({
  id: z.string(),
  type: z.literal('order.updated'),
  resource: z.object({ type: z.literal('order'), id: z.string() }),
  version: z.number().int(),
  occurredAt: z.string(),
  userId: z.string(),
  data: z.object({
    status: z.enum(orderStatuses),
    statusReason: z.string().nullable(),
  }),
})
export type OrderUpdatedEvent = z.infer<typeof orderUpdatedEventSchema>

export type RealtimeEvent = NftUpdatedEvent | OrderUpdatedEvent
