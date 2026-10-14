import { QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { authApi } from '@/api/services'
import { sessionStore } from '@/auth/session-store'
import { useSession } from '@/auth/use-session'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { queryKeys } from '@/queries/keys'
import { createQueryClient } from '@/queries/query-client'
import { RealtimeProvider } from '@/realtime/realtime-provider'
import { createAppRouter } from '@/router'

/**
 * Efeitos globais de sessão:
 *  - ao terminar uma sessão (logout, expiração, troca de usuário), cancela e
 *    remove todo o cache privado do usuário anterior;
 *  - após refresh, confirma a sessão persistida com `GET /auth/session`.
 */
function SessionEffects() {
  const queryClient = useQueryClient()
  const session = useSession()
  const userId = session.status === 'authenticated' ? session.user.id : null

  useEffect(
    () =>
      sessionStore.onSessionEnd((_reason, endedUserId) => {
        void queryClient.cancelQueries({ queryKey: queryKeys.private.owner(endedUserId) })
        queryClient.removeQueries({ queryKey: queryKeys.private.owner(endedUserId) })
      }),
    [queryClient],
  )

  const sessionQuery = useQuery({
    queryKey: queryKeys.private.session(userId ?? 'anonymous'),
    queryFn: ({ signal }) => authApi.session({ signal }),
    enabled: userId !== null,
    staleTime: Infinity,
  })

  useEffect(() => {
    if (sessionQuery.data) sessionStore.updateUser(sessionQuery.data.user)
  }, [sessionQuery.data])

  return null
}

export function App() {
  const [queryClient] = useState(createQueryClient)
  const [router] = useState(() => createAppRouter(queryClient))

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <SessionEffects />
        <RealtimeProvider>
          <RouterProvider router={router} />
        </RealtimeProvider>
        <Toaster position="top-center" closeButton richColors={false} mobileOffset={{ top: 76 }} />
      </TooltipProvider>
    </QueryClientProvider>
  )
}
