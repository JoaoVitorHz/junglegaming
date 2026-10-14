import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuantityStepperProps {
  value: number
  min?: number
  max: number
  onChange: (value: number) => void
  label: string
  disabled?: boolean
  size?: 'md' | 'sm'
  className?: string
}

/** Controle de quantidade (inteiros) com limites anunciados para leitores de tela. */
export function QuantityStepper({ value, min = 1, max, onChange, label, disabled, size = 'md', className }: QuantityStepperProps) {
  const button = cn(
    'grid shrink-0 place-items-center rounded-full bg-copper text-ink transition-opacity hover:bg-copper-bright disabled:cursor-not-allowed disabled:bg-surface-raised disabled:text-khaki',
    size === 'md' ? 'h-[42px] w-7' : 'size-6 rounded-full',
  )
  return (
    <div role="group" aria-label={label} className={cn('flex items-center', size === 'md' ? 'gap-3' : 'gap-2', className)}>
      <button
        type="button"
        className={button}
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= min}
        aria-label={`Diminuir quantidade de ${label}`}
      >
        <Minus className={size === 'md' ? 'size-5' : 'size-3.5'} strokeWidth={3} aria-hidden="true" />
      </button>
      <output aria-live="polite" aria-label={`Quantidade de ${label}`} className={cn('min-w-5 text-center tabular-nums', size === 'md' ? 'text-lg' : 'text-base')}>
        {value}
      </output>
      <button
        type="button"
        className={button}
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= max}
        aria-label={`Aumentar quantidade de ${label}`}
      >
        <Plus className={size === 'md' ? 'size-5' : 'size-3.5'} strokeWidth={3} aria-hidden="true" />
      </button>
    </div>
  )
}
