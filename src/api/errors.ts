import { isAxiosError } from 'axios'
import { apiErrorBody, type ApiErrorCode } from './contracts'

export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'canceled' | 'contract'

/**
 * Erro normalizado da camada de transporte. Toda falha de rede, HTTP ou de
 * contrato chega à interface com este formato.
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | null
  readonly code: ApiErrorCode | null
  readonly fieldErrors: Record<string, string>
  readonly details: unknown

  constructor(params: {
    kind: ApiErrorKind
    message: string
    status?: number | null
    code?: ApiErrorCode | null
    fieldErrors?: Record<string, string>
    details?: unknown
  }) {
    super(params.message)
    this.name = 'ApiError'
    this.kind = params.kind
    this.status = params.status ?? null
    this.code = params.code ?? null
    this.fieldErrors = params.fieldErrors ?? {}
    this.details = params.details
  }

  /** Falhas que podem ser repetidas com segurança. */
  get isTransient() {
    return this.kind === 'network' || this.kind === 'timeout' || (this.status !== null && this.status >= 500)
  }

  get isAuthError() {
    return this.code === 'UNAUTHENTICATED' || this.code === 'SESSION_EXPIRED'
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (isAxiosError(error)) {
    if (error.code === 'ERR_CANCELED') {
      return new ApiError({ kind: 'canceled', message: 'Requisição cancelada.' })
    }
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ApiError({ kind: 'timeout', message: 'O servidor demorou para responder. Tente novamente.' })
    }
    if (!error.response) {
      return new ApiError({ kind: 'network', message: 'Sem conexão com o servidor. Verifique sua internet e tente novamente.' })
    }
    const parsed = apiErrorBody.safeParse(error.response.data)
    if (parsed.success) {
      return new ApiError({
        kind: 'http',
        status: error.response.status,
        code: parsed.data.error.code,
        message: parsed.data.error.message,
        fieldErrors: parsed.data.error.fieldErrors,
        details: parsed.data.error.details,
      })
    }
    return new ApiError({
      kind: 'http',
      status: error.response.status,
      message: error.response.status >= 500 ? 'Erro no servidor. Tente novamente em instantes.' : 'Não foi possível concluir a operação.',
    })
  }
  return new ApiError({ kind: 'contract', message: error instanceof Error ? error.message : 'Erro inesperado.' })
}

export function errorMessage(error: unknown) {
  return toApiError(error).message
}
