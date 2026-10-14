import { useQueryClient } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { Category, Network, NftSummary } from '@/api/contracts'
import { errorMessage } from '@/api/errors'
import { NftCard, NftCardSkeleton } from '@/components/nft/nft-card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { CatalogFilters } from '@/features/catalog/catalog-filters'
import { CatalogPagination, CatalogTabs, SortSelect } from '@/features/catalog/catalog-toolbar'
import { Journal, Promos } from '@/features/catalog/editorial'
import { Hero, Spotlight } from '@/features/catalog/hero'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { cn } from '@/lib/utils'
import { useAddToCart } from '@/queries/cart'
import { useFavorites, useToggleFavorite } from '@/queries/favorites'
import { nftApi } from '@/api/services'
import { queryKeys } from '@/queries/keys'
import { useFeatured, useNftList } from '@/queries/nfts'
import { CATALOG_PAGE_SIZE, parseCategories, parseNetworks, toNftListQuery, type CatalogSearch } from '@/routes/search'

const route = getRouteApi('/')

function toggle<T>(list: T[], value: T) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

/** Campo de busca ligado à URL (`?q=`), com debounce para não criar uma entrada de histórico por tecla. */
function SearchField({ value, onSearch, className }: { value: string; onSearch: (q: string) => void; className?: string }) {
  const [text, setText] = useState(value)
  const lastSent = useRef(value)

  useEffect(() => {
    // Navegação pelo histórico: a URL manda.
    if (value !== lastSent.current) {
      lastSent.current = value
      setText(value)
    }
  }, [value])

  useEffect(() => {
    if (text.trim() === lastSent.current) return
    const handle = setTimeout(() => {
      lastSent.current = text.trim()
      onSearch(text.trim())
    }, 350)
    return () => clearTimeout(handle)
  }, [text, onSearch])

  return (
    <div className={cn('relative flex-1', className)}>
      <label htmlFor="catalog-search" className="sr-only">
        Buscar NFTs, coleções ou atributos
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-khaki" aria-hidden="true" />
      <input
        id="catalog-search"
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Explorar coleções"
        className="h-[45px] w-full rounded-[10px] bg-surface pr-9 pl-11 text-sm font-bold text-cream placeholder:text-khaki"
      />
      {text && (
        <button
          type="button"
          onClick={() => setText('')}
          className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-khaki hover:text-cream"
          aria-label="Limpar busca"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

export function HomePage() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const query = useMemo(() => toNftListQuery(search), [search])
  const list = useNftList(query)
  const featured = useFeatured()
  const favorites = useFavorites()
  const toggleFavorite = useToggleFavorite()
  const addToCart = useAddToCart()
  const queryClient = useQueryClient()
  const [filtersOpen, setFiltersOpen] = useState(false)

  useDocumentTitle(search.q ? `Busca: ${search.q}` : null)

  const selectedCategories = parseCategories(search.category)
  const selectedNetworks = parseNetworks(search.network)
  const favoriteIds = new Set(favorites.data?.nftIds ?? [])

  /** Toda mudança de filtro reinicia a paginação. */
  function updateFilters(patch: Partial<CatalogSearch>, options: { replace?: boolean } = {}) {
    void navigate({
      search: (prev) => ({ ...prev, ...patch, page: undefined }),
      replace: options.replace,
      resetScroll: false,
    })
  }

  const filterProps = {
    selectedCategories,
    selectedNetworks,
    minPrice: search.minPrice,
    maxPrice: search.maxPrice,
    facets: list.data?.facets,
    onToggleCategory: (c: Category) => updateFilters({ category: toggle(selectedCategories, c).join(',') || undefined }),
    onToggleNetwork: (n: Network) => updateFilters({ network: toggle(selectedNetworks, n).join(',') || undefined }),
    onPriceChange: (range: { minPrice?: string; maxPrice?: string }) => updateFilters(range),
    onClear: () => updateFilters({ category: undefined, network: undefined, minPrice: undefined, maxPrice: undefined }),
  }
  const activeFilterCount =
    selectedCategories.length + selectedNetworks.length + (search.minPrice || search.maxPrice ? 1 : 0)

  /** Adição rápida: usa a primeira edição disponível (a escolha completa fica no detalhe). */
  async function quickAdd(nft: NftSummary) {
    try {
      const detail = await queryClient.fetchQuery({
        queryKey: queryKeys.nfts.detail(nft.slug),
        queryFn: ({ signal }) => nftApi.detail(nft.slug, { signal }),
        staleTime: 10_000,
      })
      const edition = detail.editions.find((e) => e.available > 0)
      if (!edition) {
        toast.error(`${nft.name} está esgotado.`)
        return
      }
      addToCart.mutate(
        { nftId: nft.id, editionId: edition.id, quantity: 1 },
        {
          onSuccess: () => toast.success(`${nft.name} (edição ${edition.label}) adicionado ao carrinho.`),
          onError: (error) => toast.error(errorMessage(error)),
        },
      )
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const items = list.data?.items ?? []
  const isInitialLoading = list.isPending
  const isRefreshing = list.isFetching && !list.isPending

  return (
    <div className="container-page flex flex-col gap-4 pt-6 md:gap-24 md:pt-8">
      {/* Mobile: busca + filtros (frame "Mobile / Início") */}
      <div className="flex gap-2 md:hidden">
        <SearchField value={search.q ?? ''} onSearch={(q) => updateFilters({ q: q || undefined })} />
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="relative grid size-[45px] shrink-0 place-items-center rounded-[14px] bg-gradient-to-br from-copper/45 to-copper text-ink"
              aria-label={activeFilterCount ? `Filtros (${activeFilterCount} ativos)` : 'Filtros'}
            >
              <SlidersHorizontal className="size-5" aria-hidden="true" />
              {activeFilterCount > 0 && (
                <span aria-hidden="true" className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full border-2 border-ink bg-cream text-[10px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-3xl border-line-strong bg-surface">
            <SheetHeader>
              <SheetTitle>Filtros</SheetTitle>
              <SheetDescription>{list.data ? `${list.data.total} NFTs encontrados` : 'Carregando resultados…'}</SheetDescription>
            </SheetHeader>
            <CatalogFilters {...filterProps} className="px-4 pb-8" />
          </SheetContent>
        </Sheet>
      </div>

      <Hero items={featured.data?.hero} isLoading={featured.isPending} />

      <section id="catalogo" aria-labelledby="catalog-title" className="scroll-mt-6 md:flex md:gap-12">
        <h2 id="catalog-title" className="sr-only">
          Catálogo de NFTs
        </h2>
        <aside className="hidden w-[310px] shrink-0 flex-col gap-6 md:flex" aria-label="Filtros do catálogo">
          <div className="bg-surface p-5">
            <CatalogFilters {...filterProps} />
          </div>
          <Spotlight nft={featured.data?.spotlight} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-6 md:gap-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CatalogTabs active={search.tab ?? 'all'} />
            <div className="hidden md:block">
              <SortSelect value={search.sort ?? 'recent'} onChange={(sort) => updateFilters({ sort: sort === 'recent' ? undefined : sort })} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-sand">
            <p aria-live="polite" aria-atomic="true">
              {isInitialLoading
                ? 'Carregando NFTs…'
                : list.data
                  ? `${list.data.total} ${list.data.total === 1 ? 'NFT encontrado' : 'NFTs encontrados'}${search.q ? ` para “${search.q}”` : ''}`
                  : ''}
            </p>
            {search.q && (
              <Button variant="ghost" size="xs" onClick={() => updateFilters({ q: undefined })} className="text-copper-bright">
                Limpar busca <X aria-hidden="true" />
              </Button>
            )}
            {isRefreshing && <span className="text-xs text-khaki">Atualizando…</span>}
            <div className="ml-auto md:hidden">
              <SortSelect value={search.sort ?? 'recent'} onChange={(sort) => updateFilters({ sort: sort === 'recent' ? undefined : sort })} />
            </div>
          </div>

          {list.isError && !list.data ? (
            <Alert variant="destructive" className="border-coral/40 bg-surface">
              <AlertTitle>Não foi possível carregar o catálogo</AlertTitle>
              <AlertDescription className="flex flex-col items-start gap-3">
                <span>{errorMessage(list.error)}</span>
                <Button size="sm" onClick={() => void list.refetch()} disabled={list.isFetching}>
                  {list.isFetching ? 'Tentando…' : 'Tentar novamente'}
                </Button>
              </AlertDescription>
            </Alert>
          ) : isInitialLoading ? (
            <ul className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-2 md:gap-x-8 md:gap-y-[72px] lg:grid-cols-3" aria-busy="true" aria-label="Carregando NFTs">
              {Array.from({ length: CATALOG_PAGE_SIZE }, (_, i) => (
                <li key={i} className="max-md:even:pt-8">
                  <NftCardSkeleton />
                </li>
              ))}
            </ul>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-line-strong px-6 py-16 text-center">
              <p className="text-lg font-bold">Nenhum NFT encontrado</p>
              <p className="max-w-sm text-sm text-sand">Tente outros termos de busca ou remova alguns filtros para ver mais resultados.</p>
              <Button
                variant="outline"
                onClick={() => updateFilters({ q: undefined, category: undefined, network: undefined, minPrice: undefined, maxPrice: undefined, tab: undefined })}
              >
                Limpar busca e filtros
              </Button>
            </div>
          ) : (
            <>
              {list.isError && (
                <p role="alert" className="text-sm text-coral">
                  Não foi possível atualizar os resultados. Exibindo a última versão carregada.{' '}
                  <button type="button" className="underline" onClick={() => void list.refetch()}>
                    Tentar novamente
                  </button>
                </p>
              )}
              <ul
                className={cn(
                  'grid grid-cols-2 gap-x-4 gap-y-6 transition-opacity md:grid-cols-2 md:gap-x-8 md:gap-y-[72px] lg:grid-cols-3',
                  list.isPlaceholderData && 'opacity-60',
                )}
                aria-busy={list.isPlaceholderData}
              >
                {items.map((nft, i) => (
                  <li key={nft.id} className="max-md:even:pt-8">
                    <NftCard
                      nft={nft}
                      priority={i < 3}
                      isFavorite={favoriteIds.has(nft.id)}
                      onToggleFavorite={(n) => toggleFavorite.toggle(n.id, n.name, !favoriteIds.has(n.id))}
                      onQuickAdd={(n) => void quickAdd(n)}
                      quickAddPending={addToCart.isPending}
                    />
                  </li>
                ))}
              </ul>
              {list.data && <CatalogPagination page={list.data.page} totalPages={list.data.totalPages} />}
            </>
          )}
        </div>
      </section>

      <div className="hidden md:contents">
        <Promos />
        <Journal />
      </div>
    </div>
  )
}

