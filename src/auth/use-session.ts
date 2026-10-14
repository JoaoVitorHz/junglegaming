import { useSyncExternalStore } from 'react'
import { getGuestCartId, sessionStore, type SessionState } from './session-store'

export function useSession(): SessionState {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.getState, sessionStore.getState)
}

export function useCurrentUser() {
  const session = useSession()
  return session.status === 'authenticated' ? session.user : null
}

/** Dono do carrinho no cache: o usuário autenticado ou o carrinho de visitante. */
export function useCartOwnerKey() {
  const session = useSession()
  return session.status === 'authenticated' ? session.user.id : `guest:${getGuestCartId()}`
}
