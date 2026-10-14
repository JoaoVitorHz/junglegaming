import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'

export function NftPrice({ price, compareAtPrice, className }: { price: string; compareAtPrice?: string | null; className?: string }) {
  return (
    <p className={cn('flex flex-wrap items-baseline gap-x-3 text-lg leading-4 font-bold text-copper-bright', className)}>
      <span>
        <span className="sr-only">Preço: </span>
        {formatEth(price)}
      </span>
      {compareAtPrice && (
        <span className="font-normal text-khaki line-through">
          <span className="sr-only">Preço anterior: </span>
          {formatEth(compareAtPrice)}
        </span>
      )}
    </p>
  )
}
