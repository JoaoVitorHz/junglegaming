/**
 * Conexão Socket.IO ligada ao ciclo de vida da sessão.
 *
 * - Uma conexão por sessão: trocar de usuário/logout encerra o socket anterior
 *   e libera todos os listeners antes de abrir o próximo.
 * - Ao reconectar, os recursos ativos são reconciliados com a API REST
 *   (eventos perdidos durante a queda não são reenviados pelo servidor).
 */
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import type { Socket } from 'socket.io-client'
import { toast } from 'sonner'
import { nftUpdatedEventSchema, orderUpdatedEventSchema } from '@/api/contracts'
import { useSession } from '@/auth/use-session'
import { queryKeys } from '@/queries/keys'
import { applyNftUpdated, applyOrderUpdated, type RealtimeNotice } from './apply-events'
import { RealtimeContext, SOCKET_PATH, type RealtimeStatus } from './realtime-status'

function notify(notice: RealtimeNotice | null) {
  if (!notice) return
  const fn = notice.tone === 'success' ? toast.success : notice.tone === 'error' ? toast.error : notice.tone === 'warning' ? toast.warning : toast.info
  fn(notice.message)
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const session = useSession()
  const token = session.status === 'authenticated' ? session.token : null
  const userId = session.status === 'authenticated' ? session.user.id : null
  const [status, setStatus] = useState<RealtimeStatus>('connecting')

  useEffect(() => {
    let socket: Socket | null = null
    let disposed = false

    function connect(io: typeof import('socket.io-client').io) {
      const client = io(window.location.origin, {
        path: SOCKET_PATH,
        transports: ['websocket'],
        auth: token ? { token } : {},
        reconnectionDelay: 800,
        reconnectionDelayMax: 4000,
        forceNew: true,
      })
      let hasConnected = false

      client.on('connect', () => {
        setStatus('connected')
        if (hasConnected) {
          // Reconciliação pós-reconexão: busca o estado atual dos recursos ativos.
          void queryClient.invalidateQueries({ queryKey: queryKeys.nfts.all })
          void queryClient.invalidateQueries({ queryKey: queryKeys.private.all })
        }
        hasConnected = true
      })
      client.on('disconnect', () => setStatus('reconnecting'))
      client.io.on('reconnect_attempt', () => setStatus('reconnecting'))

      client.on('nft.updated', (payload: unknown) => {
        const parsed = nftUpdatedEventSchema.safeParse(payload)
        if (parsed.success) notify(applyNftUpdated(queryClient, parsed.data))
      })
      client.on('order.updated', (payload: unknown) => {
        const parsed = orderUpdatedEventSchema.safeParse(payload)
        if (parsed.success) notify(applyOrderUpdated(queryClient, parsed.data, userId))
      })
      return client
    }

    // Import sob demanda: o engine.io-client captura o WebSocket global ao ser
    // avaliado, então só carrega depois que a camada de mocks já está ativa
    // (e o restante do app pode baixar em paralelo aos mocks).
    void import('socket.io-client').then(({ io }) => {
      if (!disposed) socket = connect(io)
    })

    return () => {
      disposed = true
      if (!socket) return
      socket.removeAllListeners()
      socket.io.removeAllListeners()
      socket.disconnect()
    }
  }, [queryClient, token, userId])

  return <RealtimeContext.Provider value={status}>{children}</RealtimeContext.Provider>
}
