/**
 * Cliente HTTP (Axios). Única porta de saída REST da aplicação: injeta
 * cabeçalhos de sessão/carrinho, normaliza erros e valida as respostas contra
 * os contratos zod.
 */
import axios, { type AxiosRequestConfig } from 'axios'
import type { z } from 'zod'
import { getGuestCartId, sessionStore } from '@/auth/session-store'
import { API_BASE, headers } from './endpoints'
import { ApiError, toApiError } from './errors'

export const REQUEST_TIMEOUT_MS = 8000

export const http = axios.create({
  baseURL: API_BASE,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
})

http.interceptors.request.use((config) => {
  const token = sessionStore.getToken()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  config.headers.set(headers.cartId, getGuestCartId())
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const apiError = toApiError(error)
    // Token rejeitado pela API: a sessão local deixa de valer.
    const sentToken = (error?.config?.headers?.Authorization as string | undefined)?.slice(7)
    if (apiError.isAuthError && sentToken && sentToken === sessionStore.getToken()) {
      sessionStore.expire()
    }
    return Promise.reject(apiError)
  },
)

export async function request<S extends z.ZodType>(config: AxiosRequestConfig, schema: S): Promise<z.infer<S>> {
  const response = await http.request(config)
  const parsed = schema.safeParse(response.data)
  if (!parsed.success) {
    console.error('[api] resposta fora do contrato', config.url, parsed.error.issues)
    throw new ApiError({ kind: 'contract', message: 'Resposta inesperada do servidor.', details: parsed.error.issues })
  }
  return parsed.data
}

export async function requestVoid(config: AxiosRequestConfig): Promise<void> {
  await http.request(config)
}
