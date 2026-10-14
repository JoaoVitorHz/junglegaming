import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { LoginRequest, RegisterRequest, Session } from '@/api/contracts'
import { authApi } from '@/api/services'
import { queryKeys } from '@/queries/keys'
import { getGuestCartId, rotateGuestCartId, sessionStore } from './session-store'

/**
 * Login e cadastro enviam o X-Cart-Id do visitante; a API mescla esse carrinho
 * no do usuário. Depois disso o id de visitante é rotacionado.
 */
function useCompleteSignIn() {
  const queryClient = useQueryClient()
  return (session: Session) => {
    const guestKey = `guest:${getGuestCartId()}`
    sessionStore.signIn(session)
    rotateGuestCartId()
    queryClient.removeQueries({ queryKey: queryKeys.private.owner(guestKey) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.private.owner(session.user.id) })
  }
}

export function useLogin() {
  const complete = useCompleteSignIn()
  return useMutation({
    mutationFn: (body: LoginRequest) => authApi.login(body),
    onSuccess: complete,
  })
}

export function useRegister() {
  const complete = useCompleteSignIn()
  return useMutation({
    mutationFn: (body: RegisterRequest) => authApi.register(body),
    onSuccess: complete,
  })
}

export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      try {
        await authApi.logout()
      } catch {
        /* mesmo sem resposta da API, a sessão local é encerrada */
      }
    },
    onSettled: () => sessionStore.signOut(),
  })
}
