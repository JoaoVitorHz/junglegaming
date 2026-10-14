import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { ChevronLeft, Heart, Mail, ShoppingCart, ZoomIn } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { NftDetail } from '@/api/contracts'
import { errorMessage, toApiError } from '@/api/errors'
import { LinkedinIcon, TwitterIcon } from '@/components/icons/brand-icons'
import { EditionPicker } from '@/components/nft/edition-picker'
import { NftCard, NftCardSkeleton } from '@/components/nft/nft-card'
import { NftImage } from '@/components/nft/nft-image'
import { QuantityStepper } from '@/components/nft/quantity-stepper'
import { StarRating } from '@/components/nft/star-rating'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { formatEth, mulEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { useAddToCart, useCart } from '@/queries/cart'
import { useFavorites, useToggleFavorite } from '@/queries/favorites'
import { useNftDetail, useNftList } from '@/queries/nfts'
import { NotFoundPage } from './not-found-page'

const route = getRouteApi('/nft/$slug')

function defaultEdition(nft: NftDetail) {
  return (nft.editions.find((e) => e.id === '1-50' && e.available > 0) ?? nft.editions.find((e) => e.available > 0))?.id ?? null
}

function DetailSkeleton() {
  return (
    <div className="container-page flex flex-col gap-6 pt-6 md:flex-row md:gap-8 md:pt-8" aria-busy="true" aria-label="Carregando NFT">
      <div className="flex gap-7">
        <div className="hidden flex-col gap-4 md:flex">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="size-[100px]" />
          ))}
        </div>
        <Skeleton className="aspect-square w-full md:size-[444px]" />
      </div>
      <div className="flex flex-1 flex-col gap-4">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-5 w-1/4" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-7 w-1/2" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-16 w-1/2" />
      </div>
    </div>
  )
}

function ShareLinks({ nft }: { nft: NftDetail }) {
  const url = typeof window === 'undefined' ? '' : window.location.href
  const text = `${nft.name} na Kurio`
  const linkClass = 'grid size-7 place-items-center rounded-sm hover:text-copper-bright'
  return (
    <div className="flex items-center gap-2">
      <span className="text-[15px] font-bold">Compartilhar este NFT:</span>
      <a className={linkClass} href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" aria-label="Compartilhar no LinkedIn (abre em nova aba)">
        <LinkedinIcon className="size-4" />
      </a>
      <a className={linkClass} href={`mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`} aria-label="Compartilhar por e-mail">
        <Mail className="size-[18px]" aria-hidden="true" />
      </a>
      <a className={linkClass} href={`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" aria-label="Compartilhar no X (abre em nova aba)">
        <TwitterIcon className="size-4" />
      </a>
    </div>
  )
}

function Gallery({ nft }: { nft: NftDetail }) {
  const [active, setActive] = useState(0)
  const image = nft.gallery[active] ?? nft.image
  return (
    <div className="flex flex-col-reverse gap-4 md:flex-row md:gap-7">
      <ul className="hidden gap-4 md:flex md:flex-col" aria-label="Miniaturas">
        {nft.gallery.map((img, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Mostrar imagem ${i + 1} de ${nft.gallery.length}`}
              aria-current={i === active ? 'true' : undefined}
              className={cn('block overflow-hidden rounded-lg border bg-surface', i === active ? 'border-copper' : 'border-transparent')}
            >
              <NftImage imageKey={img.key} alt="" sizes="100px" className="size-[100px] rounded-lg" />
            </button>
          </li>
        ))}
      </ul>
      <div className="relative md:size-[444px] md:rounded-md md:bg-surface md:p-4">
        <NftImage
          imageKey={image.key}
          alt={image.alt}
          sizes="(min-width: 768px) 404px, 100vw"
          priority
          className="w-full rounded-3xl md:size-[404px]"
        />
        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              className="absolute top-3 right-3 grid size-[30px] place-items-center rounded-full border border-line bg-surface-raised text-cream hover:text-copper-bright max-md:hidden"
              aria-label="Ampliar imagem"
            >
              <ZoomIn className="size-4" aria-hidden="true" />
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-[min(92vw,820px)] border-line-strong bg-surface p-4 sm:max-w-[min(92vw,820px)]">
            <DialogTitle className="sr-only">{nft.name}</DialogTitle>
            <DialogDescription className="sr-only">{image.alt}</DialogDescription>
            <img src={`/nfts/${image.key}-960.webp`} alt={image.alt} width={960} height={960} className="aspect-square w-full rounded-2xl" />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

function PurchasePanel({ nft }: { nft: NftDetail }) {
  const [editionId, setEditionId] = useState<string | null>(() => defaultEdition(nft))
  const [quantity, setQuantity] = useState(1)
  const cart = useCart()
  const addToCart = useAddToCart()
  const favorites = useFavorites()
  const toggleFavorite = useToggleFavorite()
  const navigate = useNavigate()

  const edition = nft.editions.find((e) => e.id === editionId) ?? null
  // Disponibilidade pode mudar em tempo real; a edição escolhida pode esgotar.
  const editionAvailable = edition !== null && edition.available > 0
  const inCart = cart.data?.items.find((i) => i.nftId === nft.id && i.editionId === editionId)?.quantity ?? 0
  const limit = edition ? Math.max(0, Math.min(edition.available, nft.maxPerOrder) - inCart) : 0
  const safeQuantity = Math.min(Math.max(quantity, 1), Math.max(limit, 1))
  const isFavorite = favorites.data?.nftIds.includes(nft.id) ?? false

  function add(goToCart: boolean) {
    if (!edition || !editionAvailable || limit === 0) return
    addToCart.mutate(
      { nftId: nft.id, editionId: edition.id, quantity: safeQuantity },
      {
        onSuccess: () => {
          toast.success(`${nft.name} (edição ${edition.label}) × ${safeQuantity} adicionado ao carrinho.`)
          setQuantity(1)
          if (goToCart) void navigate({ to: '/carrinho' })
        },
        onError: (error) => {
          const apiError = toApiError(error)
          toast.error(apiError.message)
        },
      },
    )
  }

  const limitMessage = !edition
    ? 'Todas as edições estão esgotadas.'
    : !editionAvailable
      ? `A edição ${edition.label} está esgotada. Escolha outra edição.`
      : limit === 0
        ? `Você já tem o máximo permitido desta edição no carrinho (${inCart}).`
        : `${edition.supply === null ? 'Edição aberta' : `${edition.available} disponíveis`} · máximo de ${Math.min(edition.available, nft.maxPerOrder)} por pedido${inCart ? ` (${inCart} no carrinho)` : ''}.`

  const canBuy = editionAvailable && limit > 0 && !addToCart.isPending

  return (
    <>
      <EditionPicker
        editions={nft.editions}
        value={editionId}
        onChange={(id) => {
          setEditionId(id)
          setQuantity(1)
        }}
      />
      <p id="limit-help" className="-mt-2 text-xs text-khaki" aria-live="polite">
        {limitMessage}
      </p>

      {/* Desktop */}
      <div className="hidden items-center justify-between gap-4 md:flex">
        <QuantityStepper label={nft.name} value={safeQuantity} max={Math.max(limit, 1)} onChange={setQuantity} disabled={!canBuy} />
        <div className="flex gap-2">
          <Button className="h-10 w-[130px] text-sm font-bold" onClick={() => add(true)} disabled={!canBuy} aria-describedby="limit-help">
            {addToCart.isPending ? 'Adicionando…' : 'COMPRAR'}
          </Button>
          <Button
            variant="outline"
            className="h-10 w-[130px] border-copper bg-transparent text-sm font-medium text-copper-bright dark:bg-transparent"
            aria-pressed={isFavorite}
            onClick={() => toggleFavorite.toggle(nft.id, nft.name, !isFavorite)}
          >
            <Heart className={cn('size-5', isFavorite && 'fill-current')} aria-hidden="true" />
            {isFavorite ? 'Favoritado' : 'Favoritar'}
          </Button>
        </div>
      </div>

      {/* Mobile: barra de compra fixa */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-4 rounded-t-[28px] bg-surface px-6 pt-5 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgb(0_0_0/0.35)] md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-sand">Qtd.</span>
            <QuantityStepper label={nft.name} size="sm" value={safeQuantity} max={Math.max(limit, 1)} onChange={setQuantity} disabled={!canBuy} />
          </div>
          <p className="text-xl font-bold text-copper-bright">{formatEth(mulEth(nft.price, safeQuantity))}</p>
        </div>
        <div className="flex gap-3">
          <Button className="h-[60px] flex-1 rounded-[30px] bg-gradient-to-r from-copper to-copper/80 text-base font-bold" onClick={() => add(true)} disabled={!canBuy}>
            Comprar NFT
          </Button>
          <Button
            variant="outline"
            className="size-[60px] rounded-full border-line-strong bg-surface-raised text-copper-bright dark:bg-surface-raised"
            onClick={() => add(false)}
            disabled={!canBuy}
            aria-label="Adicionar ao carrinho"
          >
            <ShoppingCart className="size-5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </>
  )
}

function RelatedNfts({ nft }: { nft: NftDetail }) {
  const related = useNftList({ collection: nft.collection, exclude: nft.id, pageSize: 5, sort: 'popular' })
  const favorites = useFavorites()
  const toggleFavorite = useToggleFavorite()
  const ids = new Set(favorites.data?.nftIds ?? [])
  return (
    <section aria-labelledby="related-title" className="flex flex-col gap-8">
      <h2 id="related-title" className="border-b border-copper/30 pb-3 text-base font-bold text-copper-bright">
        Mais desta coleção
      </h2>
      {related.isError ? (
        <p className="text-sm text-coral">
          Não foi possível carregar a coleção.{' '}
          <button type="button" className="underline" onClick={() => void related.refetch()}>
            Tentar novamente
          </button>
        </p>
      ) : (
        <ul className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-5 md:gap-6 md:overflow-visible md:px-0">
          {related.isPending
            ? Array.from({ length: 5 }, (_, i) => (
                <li key={i} className="w-[44vw] shrink-0 snap-start md:w-auto">
                  <NftCardSkeleton />
                </li>
              ))
            : related.data?.items.map((item) => (
                <li key={item.id} className="w-[44vw] shrink-0 snap-start md:w-auto">
                  <NftCard
                    nft={item}
                    sizes="(min-width: 768px) 200px, 44vw"
                    isFavorite={ids.has(item.id)}
                    onToggleFavorite={(n) => toggleFavorite.toggle(n.id, n.name, !ids.has(n.id))}
                  />
                </li>
              ))}
        </ul>
      )}
    </section>
  )
}

export function NftDetailPage() {
  const { slug } = route.useParams()
  const detail = useNftDetail(slug)
  const favorites = useFavorites()
  const toggleFavorite = useToggleFavorite()
  const nft = detail.data
  useDocumentTitle(nft?.name ?? null)

  const attributes = useMemo(() => nft?.attributes.join(', '), [nft])

  if (detail.isPending) return <DetailSkeleton />
  if (detail.isError && !nft) {
    const error = toApiError(detail.error)
    if (error.code === 'NOT_FOUND') {
      return <NotFoundPage title="NFT não encontrado" description="Este NFT não existe, foi removido ou o endereço está incorreto." />
    }
    return (
      <div className="container-page py-16">
        <Alert variant="destructive" className="border-coral/40 bg-surface">
          <AlertTitle>Não foi possível carregar este NFT</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            <span>{errorMessage(detail.error)}</span>
            <Button size="sm" onClick={() => void detail.refetch()} disabled={detail.isFetching}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }
  if (!nft) return null
  const isFavorite = favorites.data?.nftIds.includes(nft.id) ?? false

  return (
    <div className="flex flex-col gap-16 pb-48 md:gap-24 md:pb-0">
      <div className="container-page flex flex-col gap-3 md:pt-8">
        {/* Mobile: voltar + favoritar sobre a arte */}
        <div className="flex items-center justify-between pt-6 md:hidden">
          <Link activeOptions={{ exact: true, includeHash: true }} to="/" hash="catalogo" className="grid size-9 place-items-center rounded-full border border-line-strong bg-surface-raised text-copper-bright" aria-label="Voltar ao catálogo">
            <ChevronLeft className="size-5" aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={() => toggleFavorite.toggle(nft.id, nft.name, !isFavorite)}
            aria-pressed={isFavorite}
            aria-label={isFavorite ? 'Remover da lista de interesse' : 'Adicionar à lista de interesse'}
            className="grid size-9 place-items-center rounded-full border border-line-strong bg-surface-raised text-copper-bright"
          >
            <Heart className={cn('size-4', isFavorite && 'fill-current')} aria-hidden="true" />
          </button>
        </div>

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
          </ol>
        </nav>

        <div className="flex flex-col gap-6 md:flex-row md:gap-8">
          <Gallery nft={nft} />

          <div className="flex min-w-0 flex-1 flex-col gap-5 max-md:-mx-4 max-md:rounded-t-[28px] max-md:bg-surface max-md:px-6 max-md:pt-6">
            <div className="flex flex-col gap-3 border-b border-copper/30 pb-3">
              <h1 className="text-2xl leading-9 font-bold md:text-[28px]">{nft.name}</h1>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[22px] leading-4 font-bold text-copper-bright" aria-live="polite">
                  <span className="sr-only">Preço: </span>
                  {formatEth(nft.price)}
                  {nft.compareAtPrice && <span className="ml-3 text-base font-normal text-khaki line-through">{formatEth(nft.compareAtPrice)}</span>}
                </p>
                <StarRating rating={nft.rating} count={nft.reviewCount} />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <h2 className="text-[15px] leading-4 font-bold">Sobre este NFT:</h2>
              <p className="text-sm leading-6 text-sand">{nft.description}</p>
            </div>
            <PurchasePanel key={nft.id} nft={nft} />
            <dl className="flex flex-col gap-3 text-[15px] leading-5 text-khaki">
              <div className="flex gap-1">
                <dt>ID do token:</dt>
                <dd>{nft.tokenId}</dd>
              </div>
              <div className="flex gap-1">
                <dt>Coleção:</dt>
                <dd>{nft.collection}</dd>
              </div>
              <div className="flex gap-1">
                <dt>Atributos:</dt>
                <dd>{attributes}</dd>
              </div>
            </dl>
            <ShareLinks nft={nft} />
          </div>
        </div>
      </div>

      <div className="container-page">
        <Tabs defaultValue="details" className="gap-4">
          <TabsList className="h-auto w-full justify-start gap-6 overflow-x-auto rounded-none md:gap-8 border-b border-copper/30 bg-transparent p-0 dark:bg-transparent">
            <TabsTrigger
              value="details"
              className="flex-none rounded-none border-0 border-b-2 border-transparent px-0 pb-2 text-base data-[state=active]:border-copper data-[state=active]:bg-transparent data-[state=active]:font-bold data-[state=active]:text-copper-bright data-[state=active]:shadow-none dark:data-[state=active]:border-copper dark:data-[state=active]:bg-transparent"
            >
              Detalhes do NFT
            </TabsTrigger>
            <TabsTrigger
              value="reviews"
              className="flex-none rounded-none border-0 border-b-2 border-transparent px-0 pb-2 text-base data-[state=active]:border-copper data-[state=active]:bg-transparent data-[state=active]:font-bold data-[state=active]:text-copper-bright data-[state=active]:shadow-none dark:data-[state=active]:border-copper dark:data-[state=active]:bg-transparent"
            >
              <span className="md:hidden">Avaliações ({nft.reviewCount})</span>
              <span className="max-md:hidden">Avaliações de colecionadores ({nft.reviewCount})</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="flex flex-col gap-4 text-sm leading-6 text-sand">
            {nft.longDescription.map((p) => (
              <p key={p.slice(0, 20)}>{p}</p>
            ))}
            <dl className="flex flex-col gap-3">
              <div>
                <dt className="font-bold text-cream">Rede:</dt>
                <dd>Cunhado na {nft.network === 'ethereum' ? 'Ethereum' : nft.network === 'polygon' ? 'Polygon' : 'Solana'} com procedência imutável e metadados armazenados no IPFS.</dd>
              </div>
              <div>
                <dt className="font-bold text-cream">Contrato:</dt>
                <dd>Direitos autorais do criador: {nft.royaltyPercent}% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.</dd>
              </div>
              <div>
                <dt className="font-bold text-cream">Direitos autorais:</dt>
                <dd>{nft.contract.slice(0, 6)}…{nft.contract.slice(-4)} · Contrato inteligente ERC-721 verificado.</dd>
              </div>
            </dl>
          </TabsContent>
          <TabsContent value="reviews" className="flex flex-col gap-3 text-sm text-sand">
            <StarRating rating={nft.rating} count={nft.reviewCount} />
            <p>Nota média {nft.rating.toLocaleString('pt-BR')} de 5. Os comentários detalhados dos colecionadores ainda não estão disponíveis nesta versão.</p>
          </TabsContent>
        </Tabs>
      </div>

      <div className="container-page">
        <RelatedNfts nft={nft} />
      </div>
    </div>
  )
}
