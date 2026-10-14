import { Link, useNavigate } from '@tanstack/react-router'
import { AlertTriangle, Trash2, X } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import type { Cart, CartItem } from '@/api/contracts'
import { errorMessage, toApiError } from '@/api/errors'
import { useSession } from '@/auth/use-session'
import { TotalsSummary, TotalsSummarySkeleton } from '@/components/cart/totals-summary'
import { MobileTopBar } from '@/components/layout/mobile-nav'
import { NftCard, NftCardSkeleton } from '@/components/nft/nft-card'
import { NftImage } from '@/components/nft/nft-image'
import { QuantityStepper } from '@/components/nft/quantity-stepper'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import {
  useAcknowledgeCart,
  useApplyCoupon,
  useCart,
  useRemoveCartItem,
  useRemoveCoupon,
  useUpdateCartQuantity,
} from '@/queries/cart'
import { useFavorites, useToggleFavorite } from '@/queries/favorites'
import { useNftList } from '@/queries/nfts'

function lineIssue(item: CartItem) {
  switch (item.status) {
    case 'price_changed':
      return `Preço alterado de ${formatEth(item.acknowledgedUnitPrice)} para ${formatEth(item.unitPrice)}.`
    case 'insufficient':
      return `Apenas ${item.available} disponível(is) nesta edição. Ajuste a quantidade.`
    case 'unavailable':
      return 'Esta edição esgotou e não será cobrada.'
    default:
      return null
  }
}

function CartLine({ item }: { item: CartItem }) {
  const update = useUpdateCartQuantity()
  const remove = useRemoveCartItem()
  const issue = lineIssue(item)
  const max = Math.max(1, Math.min(item.available, item.maxPerOrder))

  function changeQuantity(quantity: number) {
    update.mutate(
      { itemId: item.id, quantity },
      { onError: (error) => toast.error(`Não foi possível alterar ${item.name}: ${errorMessage(error)}`) },
    )
  }

  function removeLine() {
    remove.mutate(item.id, {
      onSuccess: () => toast.success(`${item.name} removido do carrinho.`),
      onError: (error) => toast.error(errorMessage(error)),
    })
  }

  return (
    <li className={cn('rounded-lg bg-surface md:rounded-none', item.status !== 'ok' && 'ring-1 ring-copper/60')}>
      <div className="grid grid-cols-[100px_1fr_auto] items-center gap-x-3 md:grid-cols-[minmax(0,2.3fr)_1fr_1fr_1fr_40px] md:gap-x-4 md:px-0 md:pr-4">
        {/* NFT */}
        <div className="contents md:flex md:items-center md:gap-4">
          <NftImage imageKey={item.image.key} alt="" sizes="100px" className="row-span-2 size-[100px] rounded-l-lg md:size-[70px] md:rounded-none" />
          <div className="flex min-w-0 flex-col gap-1 py-3 md:py-0">
            <Link activeOptions={{ exact: true }} to="/nft/$slug" params={{ slug: item.slug }} className="line-clamp-2 text-base leading-5 font-bold hover:text-copper-bright">
              {item.name}
            </Link>
            <p className="text-sm text-khaki md:text-[15px]">
              <span className="md:hidden">Edição: {item.editionLabel}</span>
              <span className="max-md:hidden">
                ID do token: {item.tokenId} · {item.editionLabel}
              </span>
            </p>
            <p className="text-lg font-bold text-copper-bright md:hidden">{formatEth(item.lineTotal)}</p>
          </div>
        </div>
        {/* Preço */}
        <p className="hidden text-base font-bold text-sand md:block">
          <span className="sr-only">Preço unitário: </span>
          {formatEth(item.unitPrice)}
        </p>
        {/* Edições (quantidade) */}
        <div className="flex flex-col items-end gap-2 pr-3 md:items-start md:pr-0">
          <QuantityStepper
            size="sm"
            label={item.name}
            value={item.quantity}
            max={max}
            onChange={changeQuantity}
            disabled={item.status === 'unavailable'}
          />
          <button type="button" onClick={removeLine} disabled={remove.isPending} className="flex items-center gap-1 text-xs text-khaki hover:text-coral md:hidden">
            <Trash2 className="size-4" aria-hidden="true" /> Remover
          </button>
        </div>
        {/* Total */}
        <p className="hidden text-base font-bold text-copper-bright md:block">
          <span className="sr-only">Total do item: </span>
          {formatEth(item.lineTotal)}
        </p>
        <button
          type="button"
          onClick={removeLine}
          disabled={remove.isPending}
          className="hidden size-9 place-items-center rounded-md text-sand hover:text-coral md:grid"
          aria-label={`Remover ${item.name} do carrinho`}
        >
          <Trash2 className="size-5" aria-hidden="true" />
        </button>
      </div>
      {issue && (
        <p className="flex items-start gap-2 border-t border-line px-3 py-2 text-xs text-copper-bright">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {issue}
        </p>
      )}
    </li>
  )
}

function CouponForm({ cart }: { cart: Cart }) {
  const id = useId()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const apply = useApplyCoupon()
  const remove = useRemoveCoupon()

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!code.trim()) {
      setError('Informe um código promocional.')
      return
    }
    apply.mutate(code.trim(), {
      onSuccess: (next) => {
        setError(null)
        setCode('')
        toast.success(`Cupom ${next.coupon?.code} aplicado.`)
      },
      onError: (err) => setError(toApiError(err).fieldErrors.code ?? errorMessage(err)),
    })
  }

  if (cart.coupon) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-mint/40 bg-mint/10 px-3 py-2 text-sm">
        <span>
          Cupom <strong>{cart.coupon.code}</strong> · {cart.coupon.percentOff}% de desconto
        </span>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => remove.mutate(undefined, { onError: (err) => toast.error(errorMessage(err)) })}
          disabled={remove.isPending}
          aria-label={`Remover cupom ${cart.coupon.code}`}
        >
          <X aria-hidden="true" /> Remover
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-bold max-md:sr-only">
        Código promocional
      </label>
      <div className="flex h-10 overflow-hidden border border-line max-md:h-[50px] max-md:rounded-full max-md:border-line-strong">
        <input
          id={id}
          name="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Digite o código promocional..."
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="min-w-0 flex-1 bg-transparent px-3 text-xs text-cream placeholder:text-khaki focus-visible:outline-offset-[-2px] max-md:px-4 max-md:text-sm"
        />
        <Button type="submit" disabled={apply.isPending} className="h-full rounded-none px-5 text-base font-bold max-md:rounded-full max-md:px-6">
          {apply.isPending ? 'Aplicando…' : 'Aplicar'}
        </Button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-coral">
          {error}
        </p>
      )}
    </form>
  )
}

function CheckoutButton({ cart }: { cart: Cart }) {
  const session = useSession()
  const navigate = useNavigate()
  const disabled = cart.items.length === 0 || cart.hasChanges
  return (
    <Button
      className="h-10 w-full text-base font-bold max-md:h-[60px] max-md:rounded-[30px] max-md:bg-gradient-to-r max-md:from-copper max-md:to-copper/80"
      disabled={disabled}
      aria-describedby={cart.hasChanges ? 'cart-changes' : undefined}
      onClick={() =>
        session.status === 'authenticated'
          ? void navigate({ to: '/pagamento' })
          : void navigate({ to: '/entrar', search: { redirect: '/pagamento', reason: 'required' } })
      }
    >
      Conectar e finalizar
    </Button>
  )
}

function ChangesBanner({ cart }: { cart: Cart }) {
  const acknowledge = useAcknowledgeCart()
  if (!cart.hasChanges) return null
  return (
    <Alert id="cart-changes" className="border-copper/60 bg-copper/10 text-cream">
      <AlertTriangle className="text-copper-bright" aria-hidden="true" />
      <AlertTitle>Alguns itens mudaram desde que você os adicionou</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3 text-sand">
        <span>Revise preços e disponibilidade abaixo. O resumo já mostra os valores atuais.</span>
        <Button
          size="sm"
          onClick={() =>
            acknowledge.mutate(undefined, {
              onSuccess: () => toast.success('Carrinho atualizado com os valores atuais.'),
              onError: (error) => toast.error(errorMessage(error)),
            })
          }
          disabled={acknowledge.isPending}
        >
          {acknowledge.isPending ? 'Atualizando…' : 'Aceitar alterações'}
        </Button>
      </AlertDescription>
    </Alert>
  )
}

function AlsoViewed() {
  const list = useNftList({ sort: 'popular', pageSize: 5 })
  const favorites = useFavorites()
  const toggleFavorite = useToggleFavorite()
  const ids = new Set(favorites.data?.nftIds ?? [])
  return (
    <section aria-labelledby="also-viewed" className="hidden flex-col gap-8 md:flex">
      <h2 id="also-viewed" className="border-b border-copper/30 pb-3 text-base font-bold text-copper-bright">
        Colecionadores também viram
      </h2>
      <ul className="grid grid-cols-5 gap-6">
        {list.isPending
          ? Array.from({ length: 5 }, (_, i) => (
              <li key={i}>
                <NftCardSkeleton />
              </li>
            ))
          : list.data?.items.map((item) => (
              <li key={item.id}>
                <NftCard
                  nft={item}
                  sizes="200px"
                  isFavorite={ids.has(item.id)}
                  onToggleFavorite={(n) => toggleFavorite.toggle(n.id, n.name, !ids.has(n.id))}
                />
              </li>
            ))}
      </ul>
    </section>
  )
}

function CartSkeleton() {
  return (
    <ul className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando carrinho">
      {Array.from({ length: 3 }, (_, i) => (
        <li key={i} className="flex items-center gap-4 bg-surface pr-4">
          <Skeleton className="size-[100px] rounded-none md:size-[70px]" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-6 w-20" />
        </li>
      ))}
    </ul>
  )
}

export function CartPage() {
  const cart = useCart()
  useDocumentTitle('Carrinho')
  const data = cart.data

  return (
    <div className="flex flex-col gap-16 pb-[26rem] md:gap-24 md:pb-0">
      <MobileTopBar title="Carrinho de NFTs" fallback="/" />
      <div className="container-page flex flex-col gap-4 md:pt-8">
        <nav aria-label="Trilha de navegação" className="hidden md:block">
          <ol className="flex gap-1 text-[15px] font-bold">
            <li>
              <Link activeOptions={{ exact: true }} to="/" className="hover:text-copper-bright">
                Início
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link activeOptions={{ exact: true, includeHash: true }} to="/" hash="catalogo" className="hover:text-copper-bright">
                Mercado
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">Carrinho</li>
          </ol>
        </nav>
        <h1 className="sr-only max-md:hidden">Carrinho de NFTs</h1>

        <div className="flex flex-col gap-8 lg:flex-row lg:gap-[86px]">
          <section aria-label="Itens do carrinho" className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="hidden grid-cols-[minmax(0,2.3fr)_1fr_1fr_1fr_40px] gap-x-4 border-b border-line pb-3 text-base font-bold md:grid" aria-hidden="true">
              <span>NFTs</span>
              <span>Preço</span>
              <span>Edições</span>
              <span>Total</span>
              <span />
            </div>
            {data && <ChangesBanner cart={data} />}
            {cart.isPending ? (
              <CartSkeleton />
            ) : cart.isError && !data ? (
              <Alert variant="destructive" className="border-coral/40 bg-surface">
                <AlertTitle>Não foi possível carregar o carrinho</AlertTitle>
                <AlertDescription className="flex flex-col items-start gap-3">
                  <span>{errorMessage(cart.error)}</span>
                  <Button size="sm" onClick={() => void cart.refetch()} disabled={cart.isFetching}>
                    Tentar novamente
                  </Button>
                </AlertDescription>
              </Alert>
            ) : data && data.items.length === 0 ? (
              <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-line-strong px-6 py-16 text-center">
                <p className="text-lg font-bold">Seu carrinho está vazio</p>
                <p className="max-w-sm text-sm text-sand">Explore o catálogo e adicione NFTs para começar sua coleção.</p>
                <Button asChild>
                  <Link activeOptions={{ exact: true, includeHash: true }} to="/" hash="catalogo">
                    Explorar NFTs
                  </Link>
                </Button>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {data?.items.map((item) => (
                  <CartLine key={item.id} item={item} />
                ))}
              </ul>
            )}
          </section>

          <aside
            aria-labelledby="summary-title"
            className="flex flex-col gap-5 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-30 max-md:rounded-t-[28px] max-md:bg-surface max-md:px-6 max-md:pt-6 max-md:pb-[max(1rem,env(safe-area-inset-bottom))] max-md:shadow-[0_-8px_24px_rgb(0_0_0/0.35)] md:w-full lg:w-[332px] lg:shrink-0"
          >
            <h2 id="summary-title" className="border-b border-line pb-3 text-lg font-bold max-md:sr-only">
              Resumo da carteira
            </h2>
            {cart.isPending ? (
              <TotalsSummarySkeleton />
            ) : data && data.items.length > 0 ? (
              <>
                <CouponForm cart={data} />
                <TotalsSummary totals={data.totals} couponLabel={data.coupon ? `Desconto (${data.coupon.code})` : undefined} />
                <CheckoutButton cart={data} />
                <Link activeOptions={{ exact: true, includeHash: true }} to="/" hash="catalogo" className="text-center text-base text-copper-bright hover:underline max-md:hidden">
                  Continuar explorando
                </Link>
              </>
            ) : (
              <p className="text-sm text-sand max-md:hidden">Adicione itens para ver o resumo.</p>
            )}
          </aside>
        </div>
      </div>
      <div className="container-page">
        <AlsoViewed />
      </div>
    </div>
  )
}
