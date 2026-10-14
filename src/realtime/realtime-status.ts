import { createContext, useContext } from 'react'

export type RealtimeStatus = 'connecting' | 'connected' | 'reconnecting'

export const RealtimeContext = createContext<RealtimeStatus>('connecting')

export function useRealtimeStatus() {
  return useContext(RealtimeContext)
}

/** Path do Socket.IO (o MSW intercepta este WebSocket quando os mocks estão ativos). */
export const SOCKET_PATH = '/realtime/'
