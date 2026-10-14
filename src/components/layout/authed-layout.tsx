import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { sessionStore } from '@/auth/session-store'
import { useSession } from '@/auth/use-session'

/**
 * Mantém os fluxos privados protegidos também depois do carregamento: se a
 * sessão expirar durante a navegação, leva ao login preservando o destino.
 * Redireciona uma única vez por perda de sessão (sem loop de `redirect`).
 */
export function AuthedLayout() {
  const session = useSession()
  const navigate = useNavigate()
  const href = useRouterState({ select: (s) => s.location.href })
  const redirected = useRef(false)

  useEffect(() => {
    if (session.status === 'authenticated') {
      redirected.current = false
      return
    }
    if (redirected.current || href.startsWith('/entrar') || href.startsWith('/cadastro')) return
    redirected.current = true
    // Logout explícito: volta para a Início em vez de pedir login.
    if (sessionStore.getLastEndReason() === 'logout') {
      void navigate({ to: '/', replace: true })
      return
    }
    void navigate({
      to: '/entrar',
      search: { redirect: href, reason: session.status === 'expired' ? 'expired' : 'required' },
      replace: true,
    })
  }, [session.status, href, navigate])

  if (session.status !== 'authenticated') return null
  return <Outlet />
}
