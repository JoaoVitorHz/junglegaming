import { networks, walletProviders, type Category, type Network, type OrderStatus, type SortOption, type WalletProvider } from '@/api/contracts'

export const categoryLabels: Record<Category, string> = {
  'arte-digital': 'Arte digital',
  fotografia: 'Fotografia',
  musica: 'Música',
  'arte-3d': 'Arte 3D',
  colecionaveis: 'Colecionáveis',
  generativa: 'Generativa',
  jogos: 'Jogos',
  assinaturas: 'Assinaturas',
  utilidade: 'Utilidade',
}

export const networkLabels: Record<Network, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  solana: 'Solana',
}

export const sortLabels: Record<SortOption, string> = {
  recent: 'Listados recentemente',
  'price-asc': 'Menor preço',
  'price-desc': 'Maior preço',
  popular: 'Mais avaliados',
}

export const providerLabels: Record<WalletProvider, string> = {
  metamask: 'MetaMask',
  walletconnect: 'WalletConnect',
  coinbase: 'Coinbase Wallet',
}

export const orderStatusLabels: Record<OrderStatus, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  rejected: 'Recusado',
}

/** Formata um decimal ETH no padrão brasileiro para textos de interface (ex.: "0,02"). */
export function formatEthBr(value: string, decimals = 2) {
  const [int = '0', frac = ''] = value.split('.')
  return `${int},${frac.padEnd(decimals, '0').slice(0, Math.max(decimals, frac.replace(/0+$/, '').length))}`
}

export const networkOptions = networks.map((n) => ({ value: n, label: networkLabels[n] }))
export const providerOptions = walletProviders.map((p) => ({ value: p, label: providerLabels[p] }))
