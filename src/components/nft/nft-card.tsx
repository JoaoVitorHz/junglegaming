import { Link } from '@tanstack/react-router'
import { Heart, Search, ShoppingCart } from 'lucide-react'
import type { NftSummary } from '@/api/contracts'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { NftImage } from './nft-image'
import { NftPrice } from './nft-price'

interface NftCardProps {
  nft: NftSummary
  isFavorite: boolean
  onToggleFavorite: (nft: NftSummary) => void
  onQuickAdd?: (nft: NftSummary) => void
  quickAddPending?: boolean
  priority?: boolean
  sizes?: string
  className?: string
}

const actionClass =
  'grid size-[34px] place-items-center rounded-md border border-line-strong bg-surface text-cream transition-colors hover:text-copper-bright focus-visible:text-copper-bright disabled:opacity-60'

/**
 * Card do catálogo. O nome é o link principal (área clicável estendida à
 * imagem); as ações secundárias ficam acessíveis por teclado e aparecem no
 * hover/foco em telas com ponteiro.
 */
export function NftCard({ nft, isFavorite, onToggleFavorite, onQuickAdd, quickAddPending, priority, sizes, className }: NftCardProps) {
  const soldOut = nft.totalAvailable === 0
  return (
    <article className={cn('group relative flex flex-col gap-3', className)}>
      <div className="relative grid aspect-[258/300] place-items-center overflow-hidden rounded-[20px] bg-gradient-to-br from-surface to-surface-raised p-1 md:rounded-none md:bg-none md:bg-surface">
        <NftImage
          imageKey={nft.image.key}
          alt={nft.image.alt}
          sizes={sizes ?? '(min-width: 1280px) 250px, (min-width: 768px) 30vw, 45vw'}
          priority={priority}
          className="w-[96%] rounded-2xl md:w-[250px] md:max-w-[97%] md:rounded-[15px]"
        />
        {nft.rarity !== 'comum' && (
          <span className="absolute top-4 left-0 bg-copper px-3 py-1 text-[13px] leading-4 font-medium text-ink md:top-6">
            {nft.rarity === 'raro' ? 'RARO' : 'LENDÁRIO'}
          </span>
        )}
        {soldOut && (
          <span className="absolute right-3 bottom-3 rounded-sm bg-ink/85 px-2 py-0.5 text-xs font-bold text-coral">Esgotado</span>
        )}
        <div className="absolute top-3 right-3 z-10 md:top-auto md:right-auto md:bottom-3 md:left-1/2 md:flex md:-translate-x-1/2 md:gap-2 md:opacity-0 md:transition-opacity md:group-focus-within:opacity-100 md:group-hover:opacity-100">
          {onQuickAdd && (
            <button
              type="button"
              className={cn(actionClass, 'max-md:hidden')}
              onClick={() => onQuickAdd(nft)}
              disabled={soldOut || quickAddPending}
              aria-label={`Adicionar ${nft.name} ao carrinho`}
            >
              <ShoppingCart className="size-4" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            className={cn(actionClass, 'max-md:size-7 max-md:rounded-full max-md:bg-surface-raised', isFavorite && 'text-copper-bright')}
            onClick={() => onToggleFavorite(nft)}
            aria-pressed={isFavorite}
            aria-label={isFavorite ? `Remover ${nft.name} da lista de interesse` : `Adicionar ${nft.name} à lista de interesse`}
          >
            <Heart className={cn('size-4 max-md:size-3.5', isFavorite && 'fill-current')} aria-hidden="true" />
          </button>
          <Link activeOptions={{ exact: true }}
            to="/nft/$slug"
            params={{ slug: nft.slug }}
            className={cn(actionClass, 'max-md:hidden')}
            aria-label={`Ver detalhes de ${nft.name}`}
            tabIndex={-1}
          >
            <Search className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 px-2 md:gap-3 md:px-0">
        <h3 className="text-[15px] leading-5 md:text-base md:leading-4">
          <Link activeOptions={{ exact: true }}
            to="/nft/$slug"
            params={{ slug: nft.slug }}
            className="after:absolute after:inset-0 after:z-0 hover:text-copper-bright focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-ring"
          >
            {nft.name}
          </Link>
        </h3>
        <NftPrice price={nft.price} compareAtPrice={nft.compareAtPrice} className="max-md:text-base" />
      </div>
    </article>
  )
}

export function NftCardSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      <Skeleton className="aspect-[258/300] w-full rounded-[20px] md:rounded-none" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/3" />
    </div>
  )
}
