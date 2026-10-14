/**
 * Utilitários HTTP dos handlers: respostas de erro no formato do contrato e
 * a simulação de condições de rede (latência, offline, falhas, 4xx/5xx).
 */
import { delay, HttpResponse, type DefaultBodyType, type HttpResponseResolver, type PathParams } from 'msw'
import type { ApiErrorBody, ApiErrorCode } from '@/api/contracts'
import { getScenario } from './runtime'
import type { RouteKey } from './scenarios'

const statusByCode: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 422,
  UNAUTHENTICATED: 401,
  SESSION_EXPIRED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  EMAIL_TAKEN: 409,
  USERNAME_TAKEN: 409,
  AVAILABILITY_CONFLICT: 409,
  EDITION_UNAVAILABLE: 409,
  QUOTE_OUTDATED: 409,
  IDEMPOTENCY_CONFLICT: 409,
  COUPON_INVALID: 422,
  COUPON_EXPIRED: 422,
  WALLET_REJECTED: 403,
  WALLET_DISCONNECTED: 409,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  extra: { fieldErrors?: Record<string, string>; details?: unknown; status?: number } = {},
) {
  const body: ApiErrorBody = {
    error: { code, message, fieldErrors: extra.fieldErrors, details: extra.details },
  }
  return HttpResponse.json(body, { status: extra.status ?? statusByCode[code] })
}

/** Lança uma resposta de erro (MSW interrompe o resolver e responde com ela). */
export function fail(...args: Parameters<typeof apiError>): never {
  throw apiError(...args)
}

function hashString(value: string) {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const attempts = new Map<string, number>()

/** Zera contadores de tentativas (usado no reset da simulação). */
export function resetNetworkState() {
  attempts.clear()
}

/**
 * Envolve um resolver com a simulação de rede configurada no cenário ativo.
 * Toda rota REST passa por aqui; as rotas de controle (`/__mock/*`) não.
 */
export function withNetwork<P extends PathParams, B extends DefaultBodyType>(
  route: RouteKey,
  resolver: HttpResponseResolver<P, B>,
): HttpResponseResolver<P, B> {
  return async (info) => {
    const scenario = getScenario()
    const url = new URL(info.request.url)

    let latency = scenario.latencyMs
    if (scenario.variableLatency) {
      const [min, max] = scenario.variableLatency
      latency = min + (hashString(info.request.method + url.pathname + url.search) % (max - min + 1))
    }
    if (scenario.outOfOrderSearch && route === 'nfts.list') {
      const q = url.searchParams.get('q') ?? ''
      latency = Math.max(80, 1600 - q.length * 400)
    }
    if (latency > 0) await delay(latency)

    if (scenario.offline) return HttpResponse.error()

    const attemptKey = `${info.request.method} ${url.pathname}${url.search}`
    if (scenario.flakyFirstAttempt) {
      const count = (attempts.get(attemptKey) ?? 0) + 1
      attempts.set(attemptKey, count)
      if (count === 1) {
        return apiError('SERVICE_UNAVAILABLE', 'Serviço temporariamente indisponível. Tente novamente.')
      }
    }

    const forced = scenario.failRoutes[route]
    if (forced) {
      return forced >= 500
        ? apiError(forced === 503 ? 'SERVICE_UNAVAILABLE' : 'INTERNAL_ERROR', 'Falha simulada no servidor.', { status: forced })
        : apiError('VALIDATION_ERROR', 'Requisição rejeitada pela simulação.', { status: forced })
    }

    try {
      return await resolver(info)
    } catch (thrown) {
      if (thrown instanceof Response) return thrown
      console.error('[mocks] erro inesperado no handler', thrown)
      return apiError('INTERNAL_ERROR', 'Erro inesperado na simulação.')
    }
  }
}
