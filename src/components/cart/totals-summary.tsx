import type { Totals } from '@/api/contracts'
import { Skeleton } from '@/components/ui/skeleton'
import { compareEth, formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'

/** Subtotal, desconto, taxa de rede e total — sempre os valores retornados pela API. */
export function TotalsSummary({ totals, couponLabel, className }: { totals: Totals; couponLabel?: string; className?: string }) {
  const hasDiscount = compareEth(totals.discount, '0') > 0
  return (
    <dl className={cn('flex flex-col gap-3 text-[15px]', className)}>
      <div className="flex justify-between gap-4">
        <dt>Subtotal</dt>
        <dd className="text-lg tabular-nums">{formatEth(totals.subtotal)}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>{couponLabel ?? 'Desconto do lançamento'}</dt>
        <dd className={cn('tabular-nums', hasDiscount && 'text-mint')}>
          (-) {hasDiscount ? formatEth(totals.discount) : '00.00'}
        </dd>
      </div>
      <div className="flex flex-col">
        <div className="flex justify-between gap-4">
          <dt>Taxa de rede</dt>
          <dd className="text-lg tabular-nums">{formatEth(totals.networkFee, { minDecimals: 3 })}</dd>
        </div>
        <p className="text-right text-xs text-copper-bright">Taxa estimada</p>
      </div>
      <div className="mt-3 flex justify-between gap-4 border-t border-line pt-4 font-bold">
        <dt>Total</dt>
        <dd className="text-lg text-copper-bright tabular-nums" aria-live="polite">
          {formatEth(totals.total, { minDecimals: 3 })}
        </dd>
      </div>
    </dl>
  )
}

export function TotalsSummarySkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  )
}
