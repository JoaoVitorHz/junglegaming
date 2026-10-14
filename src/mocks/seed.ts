/**
 * Fixtures determinísticas da simulação. `createSeed()` sempre devolve o mesmo
 * cenário conhecido: o reset dos mocks volta exatamente para este estado.
 */
import type { Category, Edition, Network, NftDetail, User, Wallet } from '@/api/contracts'
import { artAlt, type ArtKey } from '@/lib/art'

export interface UserRecord extends User {
  passwordHash: string
  salt: string
}

export interface Coupon {
  code: string
  percentOff: number
  description: string
  expiresAt: string | null
}

/** Senha de todos os usuários seed: Kurio@2026 (apenas o hash fica armazenado). */
export const seedUsers: UserRecord[] = [
  {
    id: 'usr_nova',
    email: 'colecionador@kurio.dev',
    username: 'nova',
    displayName: 'Nova Sato',
    ensName: 'nova',
    walletNickname: 'Principal',
    avatarUrl: null,
    updatedAt: '2026-07-01T12:00:00.000Z',
    salt: 'kurio-seed-nova',
    passwordHash: '7e63e29d1ceb7e3ff81be5dbd83bc1a8003b45a553afbe059cc98a19901c6f25',
  },
  {
    id: 'usr_teo',
    email: 'artista@kurio.dev',
    username: 'teo.mint',
    displayName: 'Téo Mint',
    ensName: 'teomint',
    walletNickname: 'Estúdio',
    avatarUrl: null,
    updatedAt: '2026-07-01T12:00:00.000Z',
    salt: 'kurio-seed-teo',
    passwordHash: '180b0fa8abdfd317c2fb64fc151127bb3e63a4edc16a101ee8677db0831a4339',
  },
]

export const seedWallets: Record<string, Wallet[]> = {
  usr_nova: [
    {
      id: 'wal_nova_primary',
      role: 'primary',
      displayName: 'Nova Sato',
      nickname: 'Principal',
      network: 'ethereum',
      profileName: 'nova.kurio',
      address: '0xA91F3c7B2d4E8f6a1B0c9D2e3F4a5B6c7D8eE82C',
      secondaryAddress: '',
      provider: 'metamask',
      referralCode: 'NOVA2026',
      email: 'colecionador@kurio.dev',
      ensName: 'nova',
      updatedAt: '2026-07-01T12:00:00.000Z',
    },
    {
      id: 'wal_nova_secondary',
      role: 'secondary',
      displayName: 'Nova Sato',
      nickname: 'Reserva',
      network: 'polygon',
      profileName: 'nova.kurio',
      address: '0x5B1e4D7a9C3f2E8b6A0d1C4e7F9a2B3c5D6e7F80',
      secondaryAddress: 'nova.kurio.eth',
      provider: 'coinbase',
      referralCode: 'NOVA2026',
      email: 'colecionador@kurio.dev',
      ensName: 'nova',
      updatedAt: '2026-07-01T12:00:00.000Z',
    },
  ],
  usr_teo: [
    {
      id: 'wal_teo_primary',
      role: 'primary',
      displayName: 'Téo Mint',
      nickname: 'Estúdio',
      network: 'ethereum',
      profileName: 'teo.mint',
      address: '0x7C2d9E1f4A6b8C0d3E5f7A9b1C2d4E6f8A0b2C4D',
      secondaryAddress: '',
      provider: 'walletconnect',
      referralCode: 'TEO2026',
      email: 'artista@kurio.dev',
      ensName: 'teomint',
      updatedAt: '2026-07-01T12:00:00.000Z',
    },
  ],
}

export const seedFavorites: Record<string, string[]> = {
  usr_nova: ['nft_sage-nomad-009'],
  usr_teo: ['nft_golden-beat-207', 'nft_ivory-baron-088'],
}

export const coupons: Coupon[] = [
  { code: 'KURIO10', percentOff: 10, description: 'Desconto do lançamento (10%)', expiresAt: null },
  { code: 'GENESIS20', percentOff: 20, description: 'Lançamento gênesis (20%)', expiresAt: null },
  { code: 'LANCAMENTO5', percentOff: 5, description: 'Pré-venda encerrada', expiresAt: '2026-01-31T23:59:59.000Z' },
]

export const NETWORK_FEE = '0.016'

/* -------------------------------------------------------------------------- */
/*                                    NFTs                                    */
/* -------------------------------------------------------------------------- */

/** PRNG determinístico (mulberry32) para gerar fixtures estáveis. */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface NftSeedInput {
  name: string
  art: ArtKey
  price: string
  compareAtPrice?: string
  category: Category
  network: Network
  collection: string
  rarity?: NftDetail['rarity']
  rating?: number
  reviewCount?: number
  /** Disponibilidade por edição: [1/1, 1/10, 1/50, ABERTA]. */
  availability?: [number, number, number, number]
  attributes?: string[]
}

const collectionByArt: Record<ArtKey, string> = {
  emerald: 'Kurio Apes',
  sage: 'Nomad Club',
  ivory: 'Ivory Society',
  golden: 'Golden Frequencies',
}

const attributesByArt: Record<ArtKey, string[]> = {
  emerald: ['Óculos', 'Esmeralda', 'Jaqueta college'],
  sage: ['Chapéu bucket', 'Moletom', 'Sálvia'],
  ivory: ['Brinco dourado', 'Gola alta', 'Blazer'],
  golden: ['Fones de ouvido', 'Pelagem dourada', 'Jaqueta creme'],
}

/** Os nove primeiros reproduzem o catálogo do Figma, na mesma ordem. */
const figmaNfts: NftSeedInput[] = [
  { name: 'Emerald Ape #042', art: 'emerald', price: '1.19', category: 'arte-digital', network: 'ethereum', collection: 'Kurio Apes', rating: 4.8, reviewCount: 19, availability: [0, 4, 20, 999], attributes: ['Óculos', 'Esmeralda', 'Raro'] },
  { name: 'Sage Nomad #009', art: 'sage', price: '1.69', category: 'colecionaveis', network: 'ethereum', collection: 'Nomad Club', rating: 4.6, reviewCount: 12 },
  { name: 'Neon Vessel #552', art: 'ivory', price: '1.99', compareAtPrice: '2.29', category: 'arte-3d', network: 'polygon', collection: 'Ivory Society', rarity: 'raro', rating: 4.9, reviewCount: 31 },
  { name: 'Cosmic Bloom #118', art: 'sage', price: '1.29', category: 'generativa', network: 'ethereum', collection: 'Nomad Club', rating: 4.4, reviewCount: 8 },
  { name: 'Violet Nomad #314', art: 'sage', price: '1.39', category: 'arte-digital', network: 'ethereum', collection: 'Nomad Club', rating: 4.5, reviewCount: 14 },
  { name: 'Ivory Baron #088', art: 'ivory', price: '1.79', category: 'fotografia', network: 'ethereum', collection: 'Ivory Society', rating: 4.7, reviewCount: 22 },
  { name: 'Golden Beat #207', art: 'golden', price: '0.99', category: 'musica', network: 'solana', collection: 'Golden Frequencies', rating: 4.3, reviewCount: 9 },
  { name: 'Golden Frequency #071', art: 'golden', price: '0.59', category: 'musica', network: 'polygon', collection: 'Golden Frequencies', rating: 4.1, reviewCount: 5 },
  { name: 'Golden Signal #160', art: 'golden', price: '0.39', category: 'musica', network: 'solana', collection: 'Golden Frequencies', rating: 4.2, reviewCount: 7, availability: [1, 0, 3, 999] },
]

const nameParts = {
  first: ['Amber', 'Copper', 'Velvet', 'Lunar', 'Quiet', 'Rustic', 'Crimson', 'Silent', 'Mossy', 'Solar', 'Hazel', 'Echo', 'Dusty', 'Jade', 'Bronze', 'Pale'],
  second: ['Monk', 'Drifter', 'Pilot', 'Scholar', 'Ranger', 'Oracle', 'Keeper', 'Rider', 'Dreamer', 'Signal', 'Warden', 'Sage', 'Echo', 'Bloom', 'Tide', 'Vessel'],
}

function generateNfts(count: number): NftSeedInput[] {
  const rand = mulberry32(2026)
  const arts: ArtKey[] = ['emerald', 'sage', 'ivory', 'golden']
  const cats: Category[] = ['arte-digital', 'fotografia', 'musica', 'arte-3d', 'colecionaveis', 'generativa', 'jogos', 'assinaturas', 'utilidade']
  const nets: Network[] = ['ethereum', 'polygon', 'solana']
  const used = new Set(figmaNfts.map((n) => n.name))
  const out: NftSeedInput[] = []
  let i = 0
  while (out.length < count) {
    const first = nameParts.first[Math.floor(rand() * nameParts.first.length)]!
    const second = nameParts.second[Math.floor(rand() * nameParts.second.length)]!
    const number = String(100 + Math.floor(rand() * 899)).padStart(3, '0')
    const name = `${first} ${second} #${number}`
    if (used.has(name)) continue
    used.add(name)
    const art = arts[i % arts.length]!
    const cents = 15 + Math.floor(rand() * 1150) // 0.15 – 11.64 ETH
    const price = (cents / 100).toFixed(2)
    const discounted = rand() < 0.15
    out.push({
      name,
      art,
      price,
      compareAtPrice: discounted ? ((cents + 20 + Math.floor(rand() * 60)) / 100).toFixed(2) : undefined,
      category: cats[i % cats.length]!,
      network: nets[Math.floor(rand() * nets.length)]!,
      collection: collectionByArt[art],
      rarity: rand() < 0.12 ? 'raro' : rand() < 0.04 ? 'lendario' : 'comum',
      rating: Math.round((3.6 + rand() * 1.4) * 10) / 10,
      reviewCount: Math.floor(rand() * 40),
      availability: [rand() < 0.5 ? 1 : 0, Math.floor(rand() * 10), Math.floor(rand() * 50), rand() < 0.1 ? 0 : 999],
    })
    i++
  }
  return out
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function buildEditions(availability: [number, number, number, number]): Edition[] {
  return [
    { id: '1-1', label: '1/1', supply: 1, available: availability[0] },
    { id: '1-10', label: '1/10', supply: 10, available: availability[1] },
    { id: '1-50', label: '1/50', supply: 50, available: availability[2] },
    { id: 'open', label: 'ABERTA', supply: null, available: availability[3] },
  ]
}

function toDetail(input: NftSeedInput, index: number): NftDetail {
  const slug = slugify(input.name)
  const tokenNumber = input.name.split('#')[1] ?? String(index)
  const editions = buildEditions(input.availability ?? [1, 6, 30, 999])
  // Datas decrescentes: o índice 0 é o listado mais recentemente.
  const createdAt = new Date(Date.UTC(2026, 8, 30, 12) - index * 36 * 3600 * 1000).toISOString()
  const attributes = input.attributes ?? attributesByArt[input.art]
  return {
    id: `nft_${slug}`,
    slug,
    name: input.name,
    tokenId: `#${tokenNumber.padStart(4, '0')}`,
    collection: input.collection,
    category: input.category,
    network: input.network,
    image: { key: input.art, alt: `${input.name}: ${artAlt[input.art]}` },
    price: input.price,
    compareAtPrice: input.compareAtPrice ?? null,
    rarity: input.rarity ?? 'comum',
    rating: input.rating ?? 4.5,
    reviewCount: input.reviewCount ?? 0,
    totalAvailable: editions.reduce((sum, e) => sum + e.available, 0),
    createdAt,
    version: 1,
    description: `Um colecionável digital finalizado à mão da coleção ${input.collection}, verificado na ${networkLabel(input.network)}, com arte desbloqueável e acesso para colecionadores.`,
    longDescription: [
      `${input.name} é uma obra digital finalizada à mão da coleção ${input.collection}. Cada atributo fica armazenado nos metadados do token e verificado na ${networkLabel(input.network)}. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.`,
      'A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. O criador recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.',
    ],
    attributes,
    contract: `0x7A42${slugHash(slug)}19E8`,
    royaltyPercent: 5,
    gallery: [0, 1, 2, 3].map((n) => ({
      key: input.art,
      alt: n === 0 ? `${input.name}: ${artAlt[input.art]}` : `${input.name}, visualização ${n + 1}`,
    })),
    editions,
    maxPerOrder: 10,
  }
}

function slugHash(slug: string) {
  let h = 0
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h.toString(16).toUpperCase().padStart(8, '0').slice(0, 4)
}

export function networkLabel(network: Network) {
  return network === 'ethereum' ? 'Ethereum' : network === 'polygon' ? 'Polygon' : 'Solana'
}

export function createSeedNfts(): NftDetail[] {
  return [...figmaNfts, ...generateNfts(39)].map(toDetail)
}

export const HERO_NFT_IDS = ['nft_emerald-ape-042', 'nft_ivory-baron-088', 'nft_golden-beat-207']
export const SPOTLIGHT_NFT_ID = 'nft_cosmic-bloom-118'
/** NFTs em alta: maior número de avaliações. Novos lançamentos: últimos 30 dias do catálogo. */
export const NEW_RELEASE_WINDOW_DAYS = 30
