/**
 * Cenários determinísticos da simulação.
 *
 * Um cenário é uma composição de presets (ex.: "slow" + "payment-rejected").
 * A seleção é persistida em localStorage e pode ser definida por:
 *   - query string na carga da página: `?mock=slow,payment-rejected`
 *   - endpoint de controle: `PUT /api/__mock/scenario { presets: [...] }`
 *   - painel "Simulação" (visível apenas com mocks ativos)
 */

export type RouteKey =
  | 'auth'
  | 'nfts.list'
  | 'nfts.detail'
  | 'nfts.featured'
  | 'favorites.read'
  | 'favorites.write'
  | 'cart.read'
  | 'cart.write'
  | 'quotes'
  | 'wallet-connections'
  | 'orders.create'
  | 'orders.read'
  | 'profile'
  | 'wallets'

export interface ScenarioConfig {
  /** Latência base (ms) aplicada a toda resposta REST. */
  latencyMs: number
  /** Latência variável determinística: [min, max] derivado do hash da URL. */
  variableLatency: [number, number] | null
  /** Latência da listagem inversamente proporcional ao tamanho da busca (respostas fora de ordem). */
  outOfOrderSearch: boolean
  /** Toda requisição REST falha com erro de rede. */
  offline: boolean
  /** A primeira tentativa de cada requisição falha com 503; a nova tentativa funciona. */
  flakyFirstAttempt: boolean
  /** Força status HTTP de erro em rotas específicas. */
  failRoutes: Partial<Record<RouteKey, number>>
  /** Catálogo vazio. */
  emptyCatalog: boolean
  /** Duração da sessão em segundos. */
  sessionTtlSeconds: number
  /** Resultado da conexão de carteira. */
  walletOutcome: 'connected' | 'rejected'
  /** Desconecta a carteira N ms após conectar (null = nunca). */
  walletDisconnectAfterMs: number | null
  /** Resultado do pagamento simulado. */
  paymentOutcome: 'confirmed' | 'rejected'
  /** Tempo até o pedido sair de "pendente". */
  orderSettleMs: number
  /** Atraso extra na resposta de criação de pedido (o pedido é criado antes). */
  orderResponseDelayMs: number
  /** Mudança disparada após a primeira cotação do checkout. */
  checkoutChange: 'price' | 'soldout' | null
}

export const defaultScenario: ScenarioConfig = {
  latencyMs: 120,
  variableLatency: null,
  outOfOrderSearch: false,
  offline: false,
  flakyFirstAttempt: false,
  failRoutes: {},
  emptyCatalog: false,
  sessionTtlSeconds: 60 * 60,
  walletOutcome: 'connected',
  walletDisconnectAfterMs: null,
  paymentOutcome: 'confirmed',
  orderSettleMs: 2500,
  orderResponseDelayMs: 0,
  checkoutChange: null,
}

export interface ScenarioPreset {
  id: string
  label: string
  description: string
  patch: Partial<ScenarioConfig>
}

export const scenarioPresets: ScenarioPreset[] = [
  { id: 'instant', label: 'Sem latência', description: 'Respostas imediatas (testes e regressão visual).', patch: { latencyMs: 0, orderSettleMs: 300 } },
  { id: 'slow', label: 'Rede lenta', description: 'Toda resposta REST demora 2,5 s.', patch: { latencyMs: 2500 } },
  { id: 'variable-latency', label: 'Latência variável', description: 'Latência de 100 ms a 1,8 s, estável por URL.', patch: { variableLatency: [100, 1800] } },
  { id: 'out-of-order', label: 'Respostas fora de ordem', description: 'Buscas mais curtas respondem por último.', patch: { outOfOrderSearch: true } },
  { id: 'offline', label: 'Sem conexão', description: 'Toda requisição REST falha com erro de rede.', patch: { offline: true } },
  { id: 'flaky', label: 'Falha transitória', description: 'A primeira tentativa de cada requisição retorna 503.', patch: { flakyFirstAttempt: true } },
  { id: 'catalog-error', label: 'Catálogo com erro 500', description: 'Listagem e destaques retornam 500.', patch: { failRoutes: { 'nfts.list': 500, 'nfts.featured': 500 } } },
  { id: 'empty', label: 'Catálogo vazio', description: 'A listagem não retorna resultados.', patch: { emptyCatalog: true } },
  { id: 'favorites-fail', label: 'Favoritos falham', description: 'Incluir/remover favorito retorna 500 (rollback otimista).', patch: { failRoutes: { 'favorites.write': 500 } } },
  { id: 'short-session', label: 'Sessão curta', description: 'A sessão expira 45 s após o login.', patch: { sessionTtlSeconds: 45 } },
  { id: 'wallet-rejected', label: 'Carteira recusa', description: 'A conexão de carteira é recusada pelo usuário.', patch: { walletOutcome: 'rejected' } },
  { id: 'wallet-disconnect', label: 'Carteira desconecta', description: 'A carteira desconecta 8 s após conectar.', patch: { walletDisconnectAfterMs: 8000 } },
  { id: 'payment-rejected', label: 'Pagamento recusado', description: 'O pedido termina como recusado.', patch: { paymentOutcome: 'rejected' } },
  { id: 'slow-settlement', label: 'Confirmação lenta', description: 'O pedido fica pendente por 20 s.', patch: { orderSettleMs: 20000 } },
  { id: 'order-timeout', label: 'Timeout no pedido', description: 'O pedido é criado, mas a resposta demora 15 s (o cliente expira em 8 s).', patch: { orderResponseDelayMs: 15000 } },
  { id: 'checkout-price-change', label: 'Preço muda no checkout', description: 'Após a primeira cotação, o preço do primeiro item sobe.', patch: { checkoutChange: 'price' } },
  { id: 'checkout-soldout', label: 'Edição esgota no checkout', description: 'Após a primeira cotação, a edição do primeiro item esgota.', patch: { checkoutChange: 'soldout' } },
]

export function resolveScenario(presetIds: string[]): ScenarioConfig {
  return presetIds.reduce<ScenarioConfig>((acc, id) => {
    const preset = scenarioPresets.find((p) => p.id === id)
    if (!preset) return acc
    return {
      ...acc,
      ...preset.patch,
      failRoutes: { ...acc.failRoutes, ...preset.patch.failRoutes },
    }
  }, defaultScenario)
}

const STORAGE_KEY = 'kurio:mock:scenario'

export function loadScenarioPresets(): string[] {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('mock')
    if (fromUrl !== null) {
      const ids = fromUrl.split(',').map((s) => s.trim()).filter(Boolean)
      saveScenarioPresets(ids)
      return ids
    }
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function saveScenarioPresets(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    /* armazenamento indisponível: o cenário vale só para esta carga */
  }
}
