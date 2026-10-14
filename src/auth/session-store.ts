/**
 * Store de sessão (fora do React, consumido via useSyncExternalStore).
 *
 * Guarda apenas token, expiração e dados públicos do usuário — nunca senhas.
 * Persistido em localStorage para recuperar a sessão após refresh; a validade
 * real é confirmada com `GET /auth/session` na inicialização.
 */
import type { Session, User } from '@/api/contracts'
import { local, randomId } from '@/lib/storage'

export type SessionState =
  | { status: 'anonymous' }
  | { status: 'authenticated'; token: string; expiresAt: string; user: User }
  /** A sessão expirou: mantém o último usuário para retomar o fluxo após novo login. */
  | { status: 'expired'; lastUserId: string }

export type SessionEndReason = 'logout' | 'expired' | 'switch'

const SESSION_KEY = 'kurio:session'
const CART_KEY = 'kurio:guest-cart'

type Listener = () => void
type EndListener = (reason: SessionEndReason, userId: string) => void

function initialState(): SessionState {
  const stored = typeof window === 'undefined' ? null : local.get<Session>(SESSION_KEY)
  if (stored?.token && stored.user) {
    if (Date.parse(stored.expiresAt) <= Date.now()) return { status: 'expired', lastUserId: stored.user.id }
    return { status: 'authenticated', ...stored }
  }
  return { status: 'anonymous' }
}

let state: SessionState = initialState()
const listeners = new Set<Listener>()
const endListeners = new Set<EndListener>()
let expiryTimer: ReturnType<typeof setTimeout> | undefined

function emit() {
  for (const l of listeners) l()
}

function scheduleExpiry() {
  clearTimeout(expiryTimer)
  if (state.status !== 'authenticated') return
  const ms = Date.parse(state.expiresAt) - Date.now()
  // setTimeout aceita no máximo ~24,8 dias.
  if (ms < 2 ** 31 - 1) expiryTimer = setTimeout(() => sessionStore.expire(), Math.max(0, ms))
}

export const sessionStore = {
  getState: () => state,

  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },

  /** Notifica quando uma sessão termina (para limpar cache e subscriptions). */
  onSessionEnd(listener: EndListener) {
    endListeners.add(listener)
    return () => {
      endListeners.delete(listener)
    }
  },

  getToken() {
    return state.status === 'authenticated' ? state.token : null
  },

  getUserId() {
    return state.status === 'authenticated' ? state.user.id : null
  },

  signIn(session: Session) {
    const previous = state.status === 'authenticated' ? state.user.id : state.status === 'expired' ? state.lastUserId : null
    if (previous && previous !== session.user.id) {
      for (const l of endListeners) l('switch', previous)
    }
    state = { status: 'authenticated', ...session }
    local.set(SESSION_KEY, session)
    scheduleExpiry()
    emit()
  },

  updateUser(user: User) {
    if (state.status !== 'authenticated' || state.user.id !== user.id) return
    state = { ...state, user }
    local.set(SESSION_KEY, { token: state.token, expiresAt: state.expiresAt, user })
    emit()
  },

  /** Logout explícito: limpa tudo. */
  signOut() {
    const userId = state.status === 'authenticated' ? state.user.id : state.status === 'expired' ? state.lastUserId : null
    state = { status: 'anonymous' }
    local.remove(SESSION_KEY)
    clearTimeout(expiryTimer)
    if (userId) for (const l of endListeners) l('logout', userId)
    emit()
  },

  /** Expiração (detectada no cliente ou informada pela API com 401). */
  expire() {
    if (state.status !== 'authenticated') return
    const userId = state.user.id
    state = { status: 'expired', lastUserId: userId }
    local.remove(SESSION_KEY)
    clearTimeout(expiryTimer)
    for (const l of endListeners) l('expired', userId)
    emit()
  },

  /** Expirada → anônima (ex.: usuário fecha o aviso e segue como visitante). */
  dismissExpired() {
    if (state.status !== 'expired') return
    state = { status: 'anonymous' }
    emit()
  },
}

scheduleExpiry()

/** Identificador do carrinho do visitante (o carrinho em si vive na API). */
export function getGuestCartId() {
  let id = local.get<string>(CART_KEY)
  if (!id) {
    id = randomId('guest')
    local.set(CART_KEY, id)
  }
  return id
}

/** Após o merge no login, o carrinho de visitante deixa de existir na API. */
export function rotateGuestCartId() {
  local.set(CART_KEY, randomId('guest'))
}
