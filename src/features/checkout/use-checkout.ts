/**
 * Fluxo de checkout:
 *
 *   formulário ──(validar, conectar carteira, cotar)──▶ revisão
 *   revisão ──(confirmar: POST /orders com Idempotency-Key)──▶ pendente
 *   pendente ──(order.updated / polling)──▶ confirmado (recibo) | recusado
 *
 * Regras:
 *  - a cotação da API é a referência: se preço, disponibilidade, cupom ou
 *    taxas mudarem (evento em tempo real ou 409 QUOTE_OUTDATED), o usuário
 *    precisa revisar e confirmar de novo;
 *  - uma tentativa de compra usa sempre a mesma chave de idempotência
 *    (inclusive após timeout e refresh), então nunca cria pedido duplicado;
 *  - o pedido pendente é retomado após refresh/reconexão.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import { quoteSchema, type CollectorDetails, type Order, type Quote, type WalletConnection } from '@/api/contracts'
import { ApiError, toApiError } from '@/api/errors'
import { checkoutApi, ordersApi } from '@/api/services'
import { useCurrentUser } from '@/auth/use-session'
import { randomId, session as sessionStorageSafe } from '@/lib/storage'
import { useAcknowledgeCart } from '@/queries/cart'
import { queryKeys } from '@/queries/keys'
import { pendingOrderStorage } from '@/queries/orders'

export type CheckoutStep =
  | { kind: 'form' }
  | { kind: 'review'; quote: Quote; collector: CollectorDetails; walletId: string | null; requoted: boolean }
  | { kind: 'pending'; orderId: string }

export const MAX_ORDER_ATTEMPTS = 3

interface Attempt {
  key: string
  quoteId: string
}

const attemptKey = (userId: string) => `kurio:checkout-attempt:${userId}`

export function useCheckout(initialPendingOrderId: string | null) {
  const user = useCurrentUser()
  const userId = user?.id ?? 'anonymous'
  const queryClient = useQueryClient()
  const acknowledge = useAcknowledgeCart()
  const [step, setStep] = useState<CheckoutStep>(initialPendingOrderId ? { kind: 'pending', orderId: initialPendingOrderId } : { kind: 'form' })
  const [connection, setConnection] = useState<WalletConnection | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [retryNotice, setRetryNotice] = useState<string | null>(null)
  const submitting = useRef(false)

  const connect = useMutation({ mutationFn: checkoutApi.connectWallet })
  const quote = useMutation({ mutationFn: checkoutApi.quote })
  const disconnect = useMutation({ mutationFn: (id: string) => checkoutApi.disconnectWallet(id) })

  /** Garante uma conexão ativa para a carteira/rede escolhidas (reaproveita se possível). */
  const ensureConnection = useCallback(
    async (walletId: string | null, collector: CollectorDetails) => {
      if (
        connection &&
        connection.status === 'connected' &&
        connection.walletId === (walletId ?? 'external') &&
        connection.provider === collector.provider &&
        connection.network === collector.network
      ) {
        const fresh = await checkoutApi.connection(connection.id).catch(() => null)
        if (fresh?.status === 'connected') return fresh
      }
      const next = await connect.mutateAsync({ walletId: walletId ?? 'external', provider: collector.provider, network: collector.network })
      setConnection(next)
      return next
    },
    [connection, connect],
  )

  /** Formulário válido → conecta a carteira e pede a cotação para revisão. */
  const review = useCallback(
    async (collector: CollectorDetails, walletId: string | null) => {
      setError(null)
      try {
        await ensureConnection(walletId, collector)
        const q = await quote.mutateAsync()
        setStep({ kind: 'review', quote: q, collector, walletId, requoted: false })
      } catch (e) {
        setError(toApiError(e))
      }
    },
    [ensureConnection, quote],
  )

  /** Aceita as mudanças do carrinho (se houver) e gera nova cotação: exige nova confirmação. */
  const requote = useCallback(
    async (hasCartChanges: boolean) => {
      if (step.kind !== 'review') return
      setError(null)
      try {
        if (hasCartChanges) await acknowledge.mutateAsync()
        const q = await quote.mutateAsync()
        setStep({ ...step, quote: q, requoted: true })
      } catch (e) {
        setError(toApiError(e))
      }
    },
    [acknowledge, quote, step],
  )

  const reconnect = useCallback(async () => {
    if (step.kind !== 'review') return
    setError(null)
    try {
      setConnection(null)
      const next = await connect.mutateAsync({
        walletId: step.walletId ?? 'external',
        provider: step.collector.provider,
        network: step.collector.network,
      })
      setConnection(next)
    } catch (e) {
      setError(toApiError(e))
    }
  }, [connect, step])

  const disconnectWallet = useCallback(async () => {
    if (!connection) return
    await disconnect.mutateAsync(connection.id).catch(() => undefined)
    setConnection({ ...connection, status: 'disconnected' })
  }, [connection, disconnect])

  /** Chave de idempotência da tentativa atual (mesma cotação → mesma chave, inclusive após refresh). */
  function attemptFor(quoteId: string): Attempt {
    const stored = sessionStorageSafe.get<Attempt>(attemptKey(userId))
    if (stored && stored.quoteId === quoteId) return stored
    const attempt = { key: randomId('ord'), quoteId }
    sessionStorageSafe.set(attemptKey(userId), attempt)
    return attempt
  }

  const [placing, setPlacing] = useState(false)

  const placeOrder = useCallback(async () => {
    if (step.kind !== 'review' || submitting.current) return
    if (!connection || connection.status !== 'connected') {
      setError(new ApiError({ kind: 'http', code: 'WALLET_DISCONNECTED', message: 'Conecte a carteira para concluir a compra.' }))
      return
    }
    submitting.current = true
    setPlacing(true)
    setError(null)
    setRetryNotice(null)
    const attempt = attemptFor(step.quote.id)
    const note = step.collector.note?.trim()
    const secondary = step.collector.secondaryAddress?.trim()
    const body = {
      quoteId: step.quote.id,
      walletId: step.walletId,
      connectionId: connection.id,
      collector: { ...step.collector, note: note || undefined, secondaryAddress: secondary || undefined },
    }

    let order: Order | null = null
    try {
      for (let i = 1; i <= MAX_ORDER_ATTEMPTS && !order; i++) {
        try {
          order = await ordersApi.create(body, attempt.key)
        } catch (e) {
          const err = toApiError(e)
          // Falha transitória: repete com a MESMA chave; a API devolve o mesmo pedido.
          if (err.isTransient && i < MAX_ORDER_ATTEMPTS) {
            setRetryNotice(
              err.kind === 'timeout'
                ? `O servidor demorou para responder. Verificando o pedido (tentativa ${i + 1} de ${MAX_ORDER_ATTEMPTS})…`
                : `Falha de conexão. Tentando novamente (tentativa ${i + 1} de ${MAX_ORDER_ATTEMPTS})…`,
            )
            continue
          }
          throw err
        }
      }
      if (!order) throw new ApiError({ kind: 'network', message: 'Não foi possível confirmar o envio do pedido.' })

      pendingOrderStorage.set(userId, order.id)
      sessionStorageSafe.remove(attemptKey(userId))
      queryClient.setQueryData(queryKeys.private.order(userId, order.id), order)
      setStep({ kind: 'pending', orderId: order.id })
    } catch (e) {
      const err = toApiError(e)
      if (err.code === 'QUOTE_OUTDATED') {
        const parsed = quoteSchema.safeParse((err.details as { quote?: unknown } | undefined)?.quote)
        void queryClient.invalidateQueries({ queryKey: queryKeys.private.cart(userId) })
        if (parsed.success) setStep({ ...step, quote: parsed.data, requoted: true })
      }
      if (err.code === 'WALLET_DISCONNECTED') setConnection((c) => (c ? { ...c, status: 'disconnected' } : c))
      if (err.code === 'IDEMPOTENCY_CONFLICT') sessionStorageSafe.remove(attemptKey(userId))
      setError(err)
    } finally {
      submitting.current = false
      setPlacing(false)
      setRetryNotice(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, connection, userId, queryClient])

  const backToForm = useCallback(() => {
    setError(null)
    setStep({ kind: 'form' })
  }, [])

  const restart = useCallback(() => {
    pendingOrderStorage.clear(userId)
    sessionStorageSafe.remove(attemptKey(userId))
    setError(null)
    setStep({ kind: 'form' })
  }, [userId])

  const resumePending = useCallback((orderId: string) => setStep({ kind: 'pending', orderId }), [])

  return {
    step,
    connection,
    error,
    retryNotice,
    isPreparing: connect.isPending || quote.isPending,
    isRequoting: quote.isPending || acknowledge.isPending,
    isPlacing: placing,
    review,
    requote,
    reconnect,
    disconnectWallet,
    placeOrder,
    backToForm,
    restart,
    resumePending,
    clearError: () => setError(null),
  }
}
