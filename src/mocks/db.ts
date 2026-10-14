/**
 * Banco de dados da simulação. Mantém um estado único e consistente entre
 * catálogo, favoritos, carrinho, perfil, carteiras e pedidos, persistido em
 * localStorage para sobreviver a refresh. `resetDb()` restaura o seed.
 */
import type { CollectorDetails, NftDetail, Order, Wallet, WalletConnection } from '@/api/contracts'
import { createSeedNfts, seedFavorites, seedUsers, seedWallets, type UserRecord } from './seed'

export interface CartLineRecord {
  id: string
  nftId: string
  editionId: string
  quantity: number
  acknowledgedUnitPrice: string
}

export interface CartRecord {
  id: string
  ownerType: 'guest' | 'user'
  ownerId: string | null
  items: CartLineRecord[]
  couponCode: string | null
  version: number
}

export interface SessionRecord {
  token: string
  userId: string
  createdAt: number
  expiresAt: number
}

export interface QuoteRecord {
  id: string
  userId: string
  cartId: string
  cartVersion: number
  /** Assinatura dos valores cotados — qualquer mudança invalida a cotação. */
  fingerprint: string
  createdAt: number
  expiresAt: number
}

export interface OrderRecord extends Order {
  idempotencyKey: string
  requestHash: string
  settleAt: number
  outcome: 'confirmed' | 'rejected'
  quoteId: string
  collector: CollectorDetails
}

export interface DbState {
  schemaVersion: number
  seq: number
  eventSeq: number
  nfts: Record<string, NftDetail>
  users: Record<string, UserRecord>
  sessions: Record<string, SessionRecord>
  favorites: Record<string, string[]>
  carts: Record<string, CartRecord>
  userCarts: Record<string, string>
  quotes: Record<string, QuoteRecord>
  walletConnections: Record<string, WalletConnection & { userId: string; disconnectAt: number | null }>
  wallets: Record<string, Wallet[]>
  orders: Record<string, OrderRecord>
  /** userId -> idempotencyKey -> orderId */
  idempotency: Record<string, Record<string, string>>
  /** Contador de checkouts que já dispararam a mudança simulada. */
  checkoutChangeFired: Record<string, boolean>
}

const STORAGE_KEY = 'kurio:mock:db'
const SCHEMA_VERSION = 1

function createInitialState(): DbState {
  const nfts = Object.fromEntries(createSeedNfts().map((n) => [n.id, n]))
  return {
    schemaVersion: SCHEMA_VERSION,
    seq: 1000,
    eventSeq: 0,
    nfts,
    users: Object.fromEntries(seedUsers.map((u) => [u.id, structuredClone(u)])),
    sessions: {},
    favorites: structuredClone(seedFavorites),
    carts: {},
    userCarts: {},
    quotes: {},
    walletConnections: {},
    wallets: structuredClone(seedWallets),
    orders: {},
    idempotency: {},
    checkoutChangeFired: {},
  }
}

function load(): DbState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DbState
      if (parsed.schemaVersion === SCHEMA_VERSION) return parsed
    }
  } catch {
    /* estado corrompido ou storage indisponível: volta ao seed */
  }
  return createInitialState()
}

export let db: DbState = load()

export function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    /* sem persistência disponível: o estado vale até o próximo refresh */
  }
}

export function resetDb() {
  db = createInitialState()
  persist()
}

export function nextId(prefix: string) {
  db.seq += 1
  return `${prefix}_${db.seq.toString(36)}`
}

export function nextEventId() {
  db.eventSeq += 1
  return `evt_${db.eventSeq.toString().padStart(6, '0')}`
}
