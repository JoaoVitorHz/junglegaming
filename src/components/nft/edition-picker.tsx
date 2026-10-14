import type { Edition } from '@/api/contracts'
import { cn } from '@/lib/utils'

interface EditionPickerProps {
  editions: Edition[]
  value: string | null
  onChange: (editionId: string) => void
}

/** Seleção de edição (radiogroup). Edições esgotadas ficam indisponíveis e sinalizadas também em texto. */
export function EditionPicker({ editions, value, onChange }: EditionPickerProps) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-[15px] leading-4 font-bold">Edição:</legend>
      <div className="flex flex-wrap gap-1.5">
        {editions.map((edition) => {
          const soldOut = edition.available === 0
          const selected = edition.id === value
          return (
            <label
              key={edition.id}
              className={cn(
                'relative flex h-7 cursor-pointer items-center rounded-full border border-line px-2 text-sm text-sand transition-colors has-focus-visible:outline-2 has-focus-visible:outline-ring',
                selected && 'border-copper font-medium text-copper-bright',
                soldOut && 'cursor-not-allowed line-through opacity-50',
              )}
            >
              <input
                type="radio"
                name="edition"
                value={edition.id}
                checked={selected}
                disabled={soldOut}
                onChange={() => onChange(edition.id)}
                className="sr-only"
              />
              {edition.label}
              <span className="sr-only">
                {soldOut ? ' (esgotada)' : ` (${edition.supply === null ? 'edição aberta' : `${edition.available} disponíveis`})`}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
