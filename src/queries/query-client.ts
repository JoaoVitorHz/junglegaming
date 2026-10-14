/**
 * Política de cache, retries e sincronização (documentada no ARCHITECTURE.md):
 *
 * - Retry automático apenas para falhas transitórias (rede, timeout, 5xx),
 *   no máximo 2 novas tentativas com backoff exponencial. Erros 4xx nunca são
 *   repetidos — são respostas definitivas do contrato.
 * - Mutations não fazem retry automático (exceto criação de pedido, que é
 *   idempotente e trata timeout explicitamente no fluxo de checkout).
 * - staleTime padrão de 30 s; o catálogo é mantido fresco por eventos
 *   `nft.updated` e reconciliado com REST a cada reconexão do socket.
 */
import { QueryClient } from '@tanstack/react-query'
import { toApiError } from '@/api/errors'

export const MAX_TRANSIENT_RETRIES = 2

export function shouldRetry(failureCount: number, error: unknown) {
  const apiError = toApiError(error)
  if (apiError.kind === 'canceled') return false
  return apiError.isTransient && failureCount < MAX_TRANSIENT_RETRIES
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetry,
        retryDelay: (attempt) => Math.min(600 * 2 ** attempt, 4000),
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: false,
      },
    },
  })
}
