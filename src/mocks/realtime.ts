/**
 * Servidor Socket.IO simulado sobre o interceptador WebSocket do MSW.
 *
 * Transporte: o `socket.io-client` da aplicação abre um WebSocket real
 * (`transports: ['websocket']`) que o MSW intercepta via `ws.link`. O
 * `@mswjs/socket.io-binding` codifica/decodifica os pacotes Engine.IO/Socket.IO.
 *
 * Limitações conhecidas (documentadas no ARCHITECTURE.md):
 *  - só o namespace "/" é suportado e não há rooms: o roteamento por usuário é
 *    feito aqui, filtrando as conexões pelo token enviado no handshake;
 *  - o binding responde ao handshake automaticamente; não existe long-polling;
 *  - o heartbeat (ping) é emitido manualmente para o cliente não expirar.
 */
import { toSocketIo } from '@mswjs/socket.io-binding'
import { ws, type WebSocketHandlerConnection } from 'msw'
import type { RealtimeEvent } from '@/api/contracts'
import { db } from './db'

/**
 * Path dedicado em vez de `/socket.io/`: o MSW reescreve esse prefixo antes do
 * match e, na raiz, o padrão colidiria com o WebSocket de HMR do Vite.
 * O MSW compara a URL sem query string.
 */
export const socketLink = ws.link(/\/realtime\/?$/)

interface LiveConnection {
  id: number
  raw: WebSocketHandlerConnection
  io: ReturnType<typeof toSocketIo>
  userId: string | null
  ping: ReturnType<typeof setInterval>
}

const connections = new Map<number, LiveConnection>()
const eventLog: RealtimeEvent[] = []
let connectionSeq = 0
let blockedUntil = 0

const PING_INTERVAL_MS = 20_000

function resolveUser(token: unknown): string | null {
  if (typeof token !== 'string') return null
  const session = db.sessions[token]
  if (!session || session.expiresAt <= Date.now()) return null
  return session.userId
}

function handleConnection(connection: WebSocketHandlerConnection) {
  if (Date.now() < blockedUntil) {
    // Servidor "fora do ar": recusa e deixa o cliente tentar reconectar.
    connection.client.close(1011, 'Servidor indisponível (simulação)')
    return
  }

  const id = ++connectionSeq
  const io = toSocketIo(connection)
  const live: LiveConnection = {
    id,
    raw: connection,
    io,
    userId: null,
    ping: setInterval(() => connection.client.send('2'), PING_INTERVAL_MS),
  }
  connections.set(id, live)

  // Pacote CONNECT do Socket.IO: "40{...auth}". Lido no nível bruto porque o
  // binding só repassa pacotes EVENT.
  connection.client.addEventListener('message', (event) => {
    if (typeof event.data !== 'string' || !event.data.startsWith('40')) return
    try {
      const auth = JSON.parse(event.data.slice(2) || '{}') as { token?: string }
      live.userId = resolveUser(auth.token)
      if (auth.token && !live.userId) {
        io.client.emit('session.invalid', { reason: 'expired' })
      }
    } catch {
      live.userId = null
    }
  })

  connection.client.addEventListener('close', () => {
    clearInterval(live.ping)
    connections.delete(id)
  })
}

export const realtimeHandlers = [socketLink.addEventListener('connection', handleConnection)]

/** Remove conexões já fechadas pelo cliente (ex.: desmontagem antes do handshake). */
function prune() {
  for (const live of [...connections.values()]) {
    // `socket` existe na implementação (WebSocketClientConnection), não no tipo de protocolo.
    const socket = (live.raw.client as unknown as { socket: WebSocket }).socket
    if (socket.readyState >= WebSocket.CLOSING) {
      clearInterval(live.ping)
      connections.delete(live.id)
    }
  }
}

/** Publica um evento. `order.updated` só chega às conexões do dono do pedido. */
export function publish(event: RealtimeEvent) {
  prune()
  eventLog.push(event)
  if (eventLog.length > 100) eventLog.shift()
  for (const live of connections.values()) {
    if (event.type === 'order.updated' && live.userId !== event.userId) continue
    live.io.client.emit(event.type, event)
  }
}

/** Reenvia um evento já publicado (simula duplicata ou evento atrasado/antigo). */
export function replay(eventId?: string, mode: 'last' | 'stale' = 'last') {
  const event = eventId
    ? eventLog.find((e) => e.id === eventId)
    : mode === 'stale'
      ? eventLog.find((e) => e.type === 'nft.updated')
      : eventLog[eventLog.length - 1]
  if (!event) return null
  for (const live of connections.values()) {
    if (event.type === 'order.updated' && live.userId !== event.userId) continue
    live.io.client.emit(event.type, event)
  }
  return event
}

export function getEventLog() {
  return [...eventLog]
}

/** Derruba todas as conexões e recusa novas por `blockMs`. */
export function disconnectAll(blockMs = 0) {
  blockedUntil = Date.now() + blockMs
  for (const live of [...connections.values()]) {
    clearInterval(live.ping)
    live.raw.client.close(1012, 'Conexão encerrada (simulação)')
    connections.delete(live.id)
  }
}

/** Encerra as conexões de um usuário (logout/expiração no servidor). */
export function revokeUser(userId: string) {
  for (const live of connections.values()) {
    if (live.userId === userId) live.userId = null
  }
}

export function resetRealtime() {
  eventLog.length = 0
  blockedUntil = 0
}

export function connectionCount() {
  prune()
  return connections.size
}
