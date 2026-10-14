import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { AlertTriangle, ChevronDown, Loader2, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { collectorDetailsSchema, type Cart, type Order, type User, type Wallet, type WalletProvider } from '@/api/contracts'
import type { ApiError } from '@/api/errors'
import { useCurrentUser } from '@/auth/use-session'
import { TotalsSummary, TotalsSummarySkeleton } from '@/components/cart/totals-summary'
import { FormError } from '@/components/form/field'
import { MobileTopBar } from '@/components/layout/mobile-nav'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { CollectorForm, type CollectorValues } from '@/features/checkout/collector-form'
import { OrderItems } from '@/features/checkout/order-items'
import { useCheckout, type CheckoutStep } from '@/features/checkout/use-checkout'
import { WalletSelector } from '@/features/checkout/wallet-selector'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useForm } from '@/hooks/use-form'
import { compareEth, formatEth } from '@/lib/eth'
import { networkLabels, providerLabels } from '@/lib/labels'
import { session as sessionStorageSafe } from '@/lib/storage'
import { useProfile, useWallets } from '@/queries/account'
import { useCart } from '@/queries/cart'
import { queryKeys } from '@/queries/keys'
import { pendingOrderStorage, useOrder, usePendingOrders } from '@/queries/orders'

const draftKey = (userId: string) => `kurio:checkout-draft:${userId}`

interface Draft {
  values: CollectorValues
  walletId: string | null
  useOther: boolean
}

function defaultsFrom(profile: User, wallet: Wallet | undefined): CollectorValues {
  return {
    displayName: wallet?.displayName ?? profile.displayName,
    username: profile.username,
    network: wallet?.network ?? '',
    profileName: wallet?.profileName ?? '',
    walletAddress: wallet?.address ?? '',
    secondaryAddress: wallet?.secondaryAddress ?? '',
    provider: wallet?.provider ?? '',
    referralCode: wallet?.referralCode ?? '',
    email: wallet?.email ?? profile.email,
    ensName: wallet?.ensName ?? profile.ensName,
    note: '',
  }
}

function walletFields(wallet: Wallet): Partial<CollectorValues> {
  return {
    network: wallet.network,
    walletAddress: wallet.address,
    secondaryAddress: wallet.secondaryAddress,
    provider: wallet.provider,
    profileName: wallet.profileName,
    referralCode: wallet.referralCode,
  }
}

function errorTitle(error: ApiError) {
  switch (error.code) {
    case 'WALLET_REJECTED':
      return 'Conexão recusada na carteira'
    case 'WALLET_DISCONNECTED':
      return 'Carteira desconectada'
    case 'QUOTE_OUTDATED':
      return 'Os valores do pedido mudaram'
    case 'IDEMPOTENCY_CONFLICT':
      return 'Tentativa de compra divergente'
    default:
      return error.isTransient ? 'Falha temporária' : 'Não foi possível continuar'
  }
}

/** Revisão antes do envio. Bloqueia a confirmação se a cotação ficou desatualizada. */
function ReviewDialog({
  step,
  cart,
  checkout,
}: {
  step: Extract<CheckoutStep, { kind: 'review' }>
  cart: Cart | undefined
  checkout: ReturnType<typeof useCheckout>
}) {
  const { quote, collector } = step
  const cartChanged =
    !!cart && (cart.hasChanges || cart.version !== quote.cartVersion || compareEth(cart.totals.total, quote.totals.total) !== 0)
  const outdated = !quote.valid || cartChanged
  const disconnected = checkout.connection?.status !== 'connected'
  const confirmRef = useRef<HTMLButtonElement>(null)

  return (
    <Dialog open onOpenChange={(open) => !open && !checkout.isPlacing && checkout.backToForm()}>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto border-line-strong bg-surface sm:max-w-[560px]"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          confirmRef.current?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>Revise seu pedido</DialogTitle>
          <DialogDescription>
            Pagamento com {providerLabels[collector.provider]} na rede {networkLabels[collector.network]}. Confira os valores antes de confirmar.
          </DialogDescription>
        </DialogHeader>

        {step.requoted && !outdated && (
          <p role="status" className="rounded-sm border border-copper/50 bg-copper/10 px-3 py-2 text-sm text-sand">
            Os valores foram atualizados com a cotação mais recente. Revise e confirme novamente.
          </p>
        )}
        {outdated && (
          <Alert className="border-copper/60 bg-copper/10 text-cream">
            <AlertTriangle className="text-copper-bright" aria-hidden="true" />
            <AlertTitle>Esta cotação está desatualizada</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-2 text-sand">
              {quote.issues.length > 0 ? (
                <ul className="list-disc pl-4">
                  {quote.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              ) : (
                <span>Preço, disponibilidade, cupom ou taxas mudaram enquanto você revisava.</span>
              )}
              <Button size="sm" onClick={() => void checkout.requote(!!cart?.hasChanges || !quote.valid)} disabled={checkout.isRequoting}>
                <RefreshCw aria-hidden="true" /> {checkout.isRequoting ? 'Atualizando…' : 'Atualizar valores'}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <OrderItems
          lines={quote.items.map((i) => ({
            key: `${i.nftId}-${i.editionId}`,
            name: i.name,
            tokenId: i.tokenId,
            imageKey: i.image.key,
            quantity: i.quantity,
            lineTotal: i.lineTotal,
          }))}
        />
        <TotalsSummary totals={quote.totals} couponLabel={quote.coupon ? `Desconto (${quote.coupon.code})` : undefined} />

        {disconnected && (
          <Alert variant="destructive" className="border-coral/40 bg-surface">
            <AlertTitle>Carteira desconectada</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-2">
              <span>Reconecte a carteira para concluir a compra.</span>
              <Button size="sm" variant="outline" onClick={() => void checkout.reconnect()}>
                Reconectar carteira
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {checkout.retryNotice && (
          <p role="status" className="flex items-center gap-2 text-sm text-sand">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {checkout.retryNotice}
          </p>
        )}
        {checkout.error && (
          <Alert variant="destructive" className="border-coral/40 bg-surface">
            <AlertTitle>{errorTitle(checkout.error)}</AlertTitle>
            <AlertDescription>{checkout.error.message}</AlertDescription>
          </Alert>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={checkout.backToForm} disabled={checkout.isPlacing} className="border-line-strong">
            Voltar e editar
          </Button>
          <Button
            ref={confirmRef}
            onClick={() => void checkout.placeOrder()}
            disabled={outdated || disconnected || checkout.isPlacing}
            aria-disabled={outdated || disconnected || checkout.isPlacing}
            className="font-bold"
          >
            {checkout.isPlacing ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" /> Enviando pedido…
              </>
            ) : (
              `Confirmar e pagar ${formatEth(quote.totals.total, { minDecimals: 3 })}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Acompanhamento do pedido enviado: pendente → confirmado (recibo) ou recusado. */
function OrderProgress({ orderId, onRestart }: { orderId: string; onRestart: () => void }) {
  const order = useOrder(orderId)
  const regionRef = useRef<HTMLDivElement>(null)
  // Ao mudar de etapa, leva leitores de tela e a rolagem para o status do pedido.
  useEffect(() => {
    window.scrollTo({ top: 0 })
    regionRef.current?.focus()
  }, [])
  const navigate = useNavigate()
  const user = useCurrentUser()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!user || !order.data) return
    if (order.data.status !== 'pending') {
      pendingOrderStorage.clear(user.id)
      void queryClient.invalidateQueries({ queryKey: queryKeys.private.pendingOrders(user.id) })
    }
    if (order.data.status === 'confirmed') {
      sessionStorageSafe.remove(draftKey(user.id))
      void navigate({ to: '/pedidos/$orderId', params: { orderId }, replace: true })
    }
  }, [order.data, user, navigate, orderId, queryClient])

  return (
    <div ref={regionRef} tabIndex={-1} className="outline-none">
      <OrderProgressContent order={order} orderId={orderId} onRestart={onRestart} />
    </div>
  )
}

function OrderProgressContent({ order, orderId, onRestart }: { order: ReturnType<typeof useOrder>; orderId: string; onRestart: () => void }) {
  const status = order.data?.status
  if (order.isError && !order.data) {
    return (
      <Alert variant="destructive" className="border-coral/40 bg-surface">
        <AlertTitle>Não foi possível consultar o pedido</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-2">
          <span>Seu pedido foi registrado. Vamos verificar o status novamente.</span>
          <Button size="sm" onClick={() => void order.refetch()}>
            Verificar agora
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!order.data || status === 'pending' || status === 'confirmed') {
    return (
      <section role="status" aria-live="polite" className="flex flex-col items-center gap-4 rounded-lg bg-surface px-6 py-12 text-center">
        <Loader2 className="size-10 animate-spin text-copper-bright" aria-hidden="true" />
        <h2 className="text-lg font-bold">{status === 'confirmed' ? 'Pagamento confirmado!' : 'Aguardando confirmação da rede…'}</h2>
        <p className="max-w-md text-sm text-sand">
          Pedido {orderId}. Você pode recarregar a página ou perder a conexão sem risco: o pedido não será duplicado e o status será recuperado.
        </p>
      </section>
    )
  }

  return <RejectedOrder order={order.data} onRestart={onRestart} />
}

function RejectedOrder({ order, onRestart }: { order: Order; onRestart: () => void }) {
  return (
    <section role="alert" className="flex flex-col items-center gap-4 rounded-lg border border-coral/40 bg-surface px-6 py-12 text-center">
      <h2 className="text-lg font-bold text-coral">Pagamento recusado</h2>
      <p className="max-w-md text-sm text-sand">
        {order.statusReason ?? 'A transação não foi concluída.'} Nenhum valor foi cobrado e seus itens continuam no carrinho.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={onRestart}>Tentar novamente</Button>
        <Button asChild variant="outline" className="border-line-strong">
          <Link to="/carrinho">Voltar ao carrinho</Link>
        </Button>
      </div>
    </section>
  )
}

function CheckoutForm({
  profile,
  wallets,
  cart,
  checkout,
}: {
  profile: User
  wallets: Wallet[]
  cart: Cart
  checkout: ReturnType<typeof useCheckout>
}) {
  const primary = wallets.find((w) => w.role === 'primary') ?? wallets[0]
  const draft = useMemo(() => sessionStorageSafe.get<Draft>(draftKey(profile.id)), [profile.id])
  const [walletId, setWalletId] = useState<string | null>(draft ? draft.walletId : (primary?.id ?? null))
  const [useOther, setUseOther] = useState(draft?.useOther ?? !primary)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const form = useForm({
    schema: collectorDetailsSchema,
    initialValues: draft?.values ?? defaultsFrom(profile, primary),
  })
  const { formRef } = form

  // Rascunho por usuário: sobrevive à expiração de sessão e ao refresh.
  useEffect(() => {
    sessionStorageSafe.set(draftKey(profile.id), { values: form.values, walletId, useOther } satisfies Draft)
  }, [form.values, walletId, useOther, profile.id])

  const locked = !useOther && walletId !== null

  function selectWallet(wallet: Wallet) {
    setUseOther(false)
    setWalletId(wallet.id)
    form.setValues((v) => ({ ...v, ...walletFields(wallet) }))
    form.setErrors({})
  }

  function toggleOther(value: boolean) {
    setUseOther(value)
    if (value) {
      setWalletId(null)
      form.setValues((v) => ({ ...v, walletAddress: '', secondaryAddress: '' }))
    } else if (primary) {
      selectWallet(primary)
    }
  }

  const submit = form.handleSubmit((collector) => void checkout.review(collector, locked ? walletId : null))
  const hasFormErrors = Object.entries(form.errors).some(([k, v]) => k !== '_form' && v)

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-8 lg:flex-row lg:gap-8">
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        {/* Mobile: dados do colecionador recolhidos (pré-preenchidos do perfil) */}
        <button
          type="button"
          className="flex items-center justify-between rounded-xl bg-surface px-4 py-3 text-left text-base font-bold md:hidden"
          aria-expanded={detailsOpen || hasFormErrors}
          aria-controls="collector-details"
          onClick={() => setDetailsOpen((o) => !o)}
        >
          Dados do colecionador
          <ChevronDown className={`size-5 transition-transform ${detailsOpen || hasFormErrors ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        <div id="collector-details" className={detailsOpen || hasFormErrors ? '' : 'max-md:hidden'}>
          <CollectorForm field={form.field} walletLocked={locked} useOtherWallet={useOther} onToggleOtherWallet={toggleOther} />
        </div>
      </div>

      <aside aria-labelledby="your-nfts" className="flex flex-col gap-5 lg:w-[405px] lg:shrink-0">
        <section className="flex flex-col gap-2 max-md:hidden">
          <h2 id="your-nfts" className="text-lg font-bold">
            Seus NFTs
          </h2>
          <OrderItems
            lines={cart.items.map((i) => ({
              key: i.id,
              name: i.name,
              tokenId: i.tokenId,
              imageKey: i.image.key,
              quantity: i.quantity,
              lineTotal: i.lineTotal,
              editionLabel: i.editionLabel,
            }))}
          />
          <p className="text-center text-[15px]">
            Tem um código promocional?{' '}
            <Link to="/carrinho" className="text-copper-bright hover:underline">
              Aplique aqui
            </Link>
          </p>
          <TotalsSummary totals={cart.totals} couponLabel={cart.coupon ? `Desconto (${cart.coupon.code})` : undefined} />
        </section>

        <WalletSelector
          wallets={wallets}
          selectedWalletId={locked ? walletId : null}
          onSelectWallet={selectWallet}
          provider={form.values.provider}
          onSelectProvider={(p: WalletProvider) => form.setValue('provider', p)}
          providerLocked={locked}
          connection={checkout.connection}
          onDisconnect={() => void checkout.disconnectWallet()}
        />

        {cart.hasChanges && (
          <p role="alert" className="text-sm text-copper-bright">
            Alguns itens do carrinho mudaram. <Link to="/carrinho" className="underline">Revise o carrinho</Link> antes de finalizar.
          </p>
        )}
        <FormError message={form.errors._form} />
        {checkout.step.kind === 'form' && checkout.error && (
          <Alert variant="destructive" className="border-coral/40 bg-surface">
            <AlertTitle>{errorTitle(checkout.error)}</AlertTitle>
            <AlertDescription>{checkout.error.message}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-4 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-30 max-md:bg-ink max-md:px-6 max-md:pt-3 max-md:pb-[max(1rem,env(safe-area-inset-bottom))]">
          <p className="flex justify-between text-lg font-bold md:hidden">
            <span>Total:</span>
            <span className="text-copper-bright">{formatEth(cart.totals.total, { minDecimals: 3 })}</span>
          </p>
          <Button
            type="submit"
            className="h-[45px] w-full text-base font-bold max-md:h-[60px] max-md:rounded-[30px] max-md:bg-gradient-to-r max-md:from-copper max-md:to-copper/80"
            disabled={checkout.isPreparing || cart.items.length === 0 || cart.hasChanges}
          >
            {checkout.isPreparing ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" /> Conectando carteira…
              </>
            ) : (
              'Confirmar compra'
            )}
          </Button>
        </div>
      </aside>
    </form>
  )
}

function CheckoutSkeleton() {
  return (
    <div className="flex flex-col gap-8 lg:flex-row" aria-busy="true" aria-label="Carregando pagamento">
      <div className="grid flex-1 gap-5 sm:grid-cols-2">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-4 lg:w-[405px]">
        <Skeleton className="h-[70px] w-full" />
        <Skeleton className="h-[70px] w-full" />
        <TotalsSummarySkeleton />
      </div>
    </div>
  )
}

export function CheckoutPage() {
  useDocumentTitle('Pagamento')
  const user = useCurrentUser()
  const profile = useProfile()
  const wallets = useWallets()
  const cart = useCart()
  const pending = usePendingOrders()
  const storedPending = user ? pendingOrderStorage.get(user.id) : null
  const checkout = useCheckout(storedPending)

  // Pedido pendente na API (ex.: outro dispositivo ou storage limpo): retoma o acompanhamento.
  const pendingId = pending.data?.[0]?.id
  const { step, resumePending } = checkout
  useEffect(() => {
    if (pendingId && step.kind === 'form') resumePending(pendingId)
  }, [pendingId, step.kind, resumePending])

  const loading = profile.isPending || wallets.isPending || cart.isPending
  const loadError = profile.error ?? wallets.error ?? cart.error

  return (
    <div className="pb-48 md:pb-0">
      <MobileTopBar title="Pagamento com carteira" fallback="/carrinho" />
      <div className="container-page flex flex-col gap-6 md:pt-8">
        <nav aria-label="Trilha de navegação" className="hidden md:block">
          <ol className="flex gap-1 text-[15px] font-bold">
            <li>
              <Link to="/" className="hover:text-copper-bright">
                Início
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link to="/" hash="catalogo" className="hover:text-copper-bright">
                Mercado
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">Pagamento</li>
          </ol>
        </nav>
        <h1 className="sr-only max-md:hidden">Pagamento</h1>

        {step.kind === 'pending' ? (
          <OrderProgress orderId={step.orderId} onRestart={checkout.restart} />
        ) : loading ? (
          <CheckoutSkeleton />
        ) : loadError && (!profile.data || !wallets.data || !cart.data) ? (
          <Alert variant="destructive" className="border-coral/40 bg-surface">
            <AlertTitle>Não foi possível carregar o pagamento</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-2">
              <span>{loadError.message}</span>
              <Button
                size="sm"
                onClick={() => {
                  void profile.refetch()
                  void wallets.refetch()
                  void cart.refetch()
                }}
              >
                Tentar novamente
              </Button>
            </AlertDescription>
          </Alert>
        ) : cart.data && cart.data.items.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-line-strong px-6 py-16 text-center">
            <p className="text-lg font-bold">Não há itens para pagar</p>
            <Button asChild>
              <Link to="/" hash="catalogo">
                Explorar NFTs
              </Link>
            </Button>
          </div>
        ) : profile.data && wallets.data && cart.data ? (
          <CheckoutForm profile={profile.data} wallets={wallets.data} cart={cart.data} checkout={checkout} />
        ) : null}
      </div>
      {step.kind === 'review' && <ReviewDialog step={step} cart={cart.data} checkout={checkout} />}
    </div>
  )
}
