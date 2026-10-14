import { useId, useState } from 'react'
import { categories, networks, type Category, type NftListResponse, type Network } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { categoryLabels, formatEthBr, networkLabels } from '@/lib/labels'
import { cn } from '@/lib/utils'

interface CatalogFiltersProps {
  selectedCategories: Category[]
  selectedNetworks: Network[]
  minPrice?: string
  maxPrice?: string
  facets: NftListResponse['facets'] | undefined
  onToggleCategory: (category: Category) => void
  onToggleNetwork: (network: Network) => void
  onPriceChange: (range: { minPrice?: string; maxPrice?: string }) => void
  onClear: () => void
  className?: string
}

const optionClass =
  'flex w-full items-center justify-between rounded-sm px-3 text-[15px] leading-10 text-sand transition-colors hover:text-copper-bright aria-pressed:text-copper-bright'

function countFor(list: { value: string; count: number }[] | undefined, value: string) {
  return list?.find((f) => f.value === value)?.count ?? 0
}

const toCents = (value: string) => Math.round(Number(value) * 100)
const fromCents = (cents: number) => (cents / 100).toFixed(2)

function PriceFilter({
  bounds,
  minPrice,
  maxPrice,
  onApply,
}: {
  bounds: { min: string; max: string } | undefined
  minPrice?: string
  maxPrice?: string
  onApply: (range: { minPrice?: string; maxPrice?: string }) => void
}) {
  const id = useId()
  const lower = bounds ? Math.floor(Number(bounds.min) * 100) : 0
  const upper = bounds ? Math.ceil(Number(bounds.max) * 100) : 1000
  const committed: [number, number] = [minPrice ? toCents(minPrice) : lower, maxPrice ? toCents(maxPrice) : upper]
  const [range, setRange] = useState<[number, number]>(committed)


  const dirty = range[0] !== committed[0] || range[1] !== committed[1]

  return (
    <div className="flex flex-col gap-3">
      <h3 id={`${id}-title`} className="text-lg leading-4 font-bold">
        Faixa de preço
      </h3>
      <div className="flex flex-col gap-3 pl-3">
        <Slider
          aria-labelledby={`${id}-title`}
          min={lower}
          max={Math.max(upper, lower + 1)}
          step={1}
          value={range}
          onValueChange={(v) => setRange([v[0] ?? lower, v[1] ?? upper])}
          minStepsBetweenThumbs={1}
          thumbLabels={['Preço mínimo', 'Preço máximo']}
          getValueText={(v) => `${formatEthBr(fromCents(v))} ETH`}
        />
        <p className="text-[15px] leading-5" aria-live="polite">
          Preço: {formatEthBr(fromCents(range[0]))} - {formatEthBr(fromCents(range[1]))} ETH
        </p>
        <Button
          size="sm"
          className="h-9 w-fit px-3 text-base font-bold"
          disabled={!dirty}
          onClick={() =>
            onApply({
              minPrice: range[0] > lower ? fromCents(range[0]) : undefined,
              maxPrice: range[1] < upper ? fromCents(range[1]) : undefined,
            })
          }
        >
          Aplicar
        </Button>
      </div>
    </div>
  )
}

export function CatalogFilters({
  selectedCategories,
  selectedNetworks,
  minPrice,
  maxPrice,
  facets,
  onToggleCategory,
  onToggleNetwork,
  onPriceChange,
  onClear,
  className,
}: CatalogFiltersProps) {
  const hasFilters = selectedCategories.length > 0 || selectedNetworks.length > 0 || minPrice || maxPrice
  return (
    <div className={cn('flex flex-col gap-10', className)}>
      <section className="flex flex-col gap-3" aria-labelledby="filter-collections">
        <h3 id="filter-collections" className="text-lg leading-4 font-bold">
          Coleções
        </h3>
        <ul>
          {categories.map((category) => {
            const active = selectedCategories.includes(category)
            const count = countFor(facets?.categories, category)
            return (
              <li key={category}>
                <button type="button" className={optionClass} aria-pressed={active} onClick={() => onToggleCategory(category)}>
                  <span>{categoryLabels[category]}</span>
                  <span className="font-bold" aria-label={`${count} resultados`}>
                    ({count})
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {/* key: mudanças externas (histórico, limpar filtros, novos limites) reiniciam o rascunho do slider */}
      <PriceFilter
        key={[minPrice, maxPrice, facets?.priceRange.min, facets?.priceRange.max].join("|")}
        bounds={facets?.priceRange} minPrice={minPrice} maxPrice={maxPrice} onApply={onPriceChange} />

      <section className="flex flex-col gap-3" aria-labelledby="filter-networks">
        <h3 id="filter-networks" className="text-lg leading-4 font-bold">
          Rede
        </h3>
        <ul>
          {networks.map((network) => {
            const active = selectedNetworks.includes(network)
            const count = countFor(facets?.networks, network)
            return (
              <li key={network}>
                <button type="button" className={optionClass} aria-pressed={active} onClick={() => onToggleNetwork(network)}>
                  <span>{networkLabels[network]}</span>
                  <span aria-label={`${count} resultados`}>({count})</span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {hasFilters && (
        <Button variant="outline" onClick={onClear} className="border-line-strong">
          Limpar filtros
        </Button>
      )}
    </div>
  )
}
