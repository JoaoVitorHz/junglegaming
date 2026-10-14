import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useId } from 'react'
import { catalogTabs, sortOptions, type CatalogTab, type SortOption } from '@/api/contracts'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { sortLabels } from '@/lib/labels'
import { cn } from '@/lib/utils'

const tabLabels: Record<CatalogTab, string> = { all: 'Todos os NFTs', new: 'Novos lançamentos', trending: 'Em alta' }

export function CatalogTabs({ active }: { active: CatalogTab }) {
  return (
    <nav aria-label="Seções do catálogo" className="-mx-1 overflow-x-auto px-1">
      <ul className="flex gap-4 whitespace-nowrap md:gap-5">
        {catalogTabs.map((tab) => (
          <li key={tab}>
            <Link activeOptions={{ exact: true }}
              to="/"
              search={(prev) => ({ ...prev, tab: tab === 'all' ? undefined : tab, page: undefined })}
              hash="catalogo"
              aria-current={active === tab ? 'page' : undefined}
              className={cn(
                'inline-block border-b-2 border-transparent pb-1 text-sm leading-4 font-normal hover:text-copper-bright md:text-[15px] md:font-medium',
                active === tab && 'border-copper font-bold text-copper-bright md:font-medium',
              )}
            >
              {tabLabels[tab]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function SortSelect({ value, onChange }: { value: SortOption; onChange: (value: SortOption) => void }) {
  const id = useId()
  return (
    <div className="flex items-center gap-1 text-[15px]">
      <label htmlFor={id} className="shrink-0">
        Ordenar por:
      </label>
      <Select value={value} onValueChange={(v) => onChange(v as SortOption)}>
        <SelectTrigger id={id} className="h-8 w-auto gap-2 border-0 bg-transparent px-1 text-[15px] shadow-none dark:bg-transparent">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {sortOptions.map((option) => (
            <SelectItem key={option} value={option}>
              {sortLabels[option]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function pageWindow(page: number, totalPages: number, size = 4) {
  const start = Math.max(1, Math.min(page - Math.floor(size / 2), totalPages - size + 1))
  return Array.from({ length: Math.min(size, totalPages) }, (_, i) => start + i)
}

const pageClass =
  'grid size-[35px] place-items-center rounded-sm border border-line text-lg leading-4 transition-colors hover:border-copper hover:text-copper-bright'

export function CatalogPagination({ page, totalPages }: { page: number; totalPages: number }) {
  if (totalPages <= 1) return null
  return (
    <nav aria-label="Paginação do catálogo" className="flex justify-end">
      <ul className="flex gap-2">
        {page > 1 && (
          <li>
            <Link activeOptions={{ exact: true }} to="/" search={(prev) => ({ ...prev, page: page - 1 === 1 ? undefined : page - 1 })} hash="catalogo" className={pageClass} aria-label="Página anterior">
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Link>
          </li>
        )}
        {pageWindow(page, totalPages).map((n) => (
          <li key={n}>
            <Link activeOptions={{ exact: true }}
              to="/"
              search={(prev) => ({ ...prev, page: n === 1 ? undefined : n })}
              hash="catalogo"
              aria-label={`Página ${n}`}
              aria-current={n === page ? 'page' : undefined}
              className={cn(pageClass, n === page && 'border-copper bg-copper font-bold text-ink hover:text-ink')}
            >
              {n}
            </Link>
          </li>
        ))}
        {page < totalPages && (
          <li>
            <Link activeOptions={{ exact: true }} to="/" search={(prev) => ({ ...prev, page: page + 1 })} hash="catalogo" className={pageClass} aria-label="Próxima página">
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          </li>
        )}
      </ul>
    </nav>
  )
}
