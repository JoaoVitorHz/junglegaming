import { Link } from '@tanstack/react-router'
import { ProfileShell } from '@/components/account/profile-shell'
import { NftCard, NftCardSkeleton } from '@/components/nft/nft-card'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useFavorites, useToggleFavorite } from '@/queries/favorites'
import { useNftList } from '@/queries/nfts'

export function FavoritesPage() {
  useDocumentTitle('Lista de interesse')
  const favorites = useFavorites()
  const toggleFavorite = useToggleFavorite()
  const ids = favorites.data?.nftIds ?? []
  const list = useNftList({ ids, pageSize: 48, sort: 'recent' }, { enabled: ids.length > 0 })
  const favoriteSet = new Set(ids)

  return (
    <ProfileShell>
      <section aria-labelledby="favorites-title" className="flex flex-col gap-6">
        <h1 id="favorites-title" className="text-base font-bold">
          Lista de interesse
        </h1>
        {favorites.isPending || (ids.length > 0 && list.isPending) ? (
          <ul className="grid grid-cols-2 gap-6 lg:grid-cols-3" aria-busy="true" aria-label="Carregando lista de interesse">
            {Array.from({ length: 3 }, (_, i) => (
              <li key={i}>
                <NftCardSkeleton />
              </li>
            ))}
          </ul>
        ) : ids.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-line-strong px-6 py-16 text-center">
            <p className="text-lg font-bold">Nenhum NFT na sua lista</p>
            <p className="max-w-sm text-sm text-sand">Toque no coração de um NFT para acompanhá-lo aqui.</p>
            <Button asChild>
              <Link activeOptions={{ exact: true, includeHash: true }} to="/" hash="catalogo">
                Explorar NFTs
              </Link>
            </Button>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-3 lg:gap-x-8">
            {list.data?.items
              .filter((nft) => favoriteSet.has(nft.id))
              .map((nft) => (
                <li key={nft.id}>
                  <NftCard nft={nft} isFavorite onToggleFavorite={(n) => toggleFavorite.toggle(n.id, n.name, false)} />
                </li>
              ))}
          </ul>
        )}
      </section>
    </ProfileShell>
  )
}
