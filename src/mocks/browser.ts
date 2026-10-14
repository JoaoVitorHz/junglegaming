/**
 * Inicialização da camada de mocks no navegador (dev e build de demonstração).
 * Ativada por `VITE_ENABLE_MOCKS=true`; nenhum código de aplicação conhece os
 * mocks — eles atuam apenas na camada de rede (HTTP e WebSocket).
 */
import { setupWorker } from 'msw/browser'
import { restHandlers } from './handlers'
import { settleDueOrders } from './logic'
import { realtimeHandlers } from './realtime'

export async function startMocks() {
  const worker = setupWorker(...restHandlers, ...realtimeHandlers)
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: !import.meta.env.DEV,
    serviceWorker: { url: '/mockServiceWorker.js' },
  })
  // Pedidos pendentes cujo prazo passou enquanto a página estava fechada.
  settleDueOrders()
  return worker
}
