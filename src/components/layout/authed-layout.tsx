import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useSession } from '@/auth/use-session'

/**
 * Mantém os fluxos privados protegidos também depois do carregamento: se a
 * sessão expirar durante a navegação, leva ao login preservando o destino.
 */
export function AuthedLayout() {
  const session = useSession()
  const navigate = useNavigate()
  const href = useRouterState({ select: (s) => s.location.href })

  useEffect(() => {
    if (session.status !== 'authenticated') {
      void navigate({
        to: '/entrar',
        search: { redirect: href, reason: session.status === 'expired' ? 'expired' : 'required' },
        replace: true,
      })
    }
  }, [session.status, href, navigate])

  if (session.status !== 'authenticated') return null
  return <Outlet />
}
