import { Link, useRouter, useRouterState } from '@tanstack/react-router'
import { ChevronLeft, Heart, House, ScanSearch, ShoppingCart, User } from 'lucide-react'
import type { ReactNode } from 'react'
import { useCurrentUser } from '@/auth/use-session'
import { cn } from '@/lib/utils'
import { useCart } from '@/queries/cart'

const itemClass =
  'flex size-12 items-center justify-center rounded-full text-cream transition-colors hover:text-copper-bright aria-[current=page]:text-copper-bright'

/** Barra de navegação inferior do mobile (frame "Mobile / Início"). */
export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const user = useCurrentUser()
  const cart = useCart()
  const count = cart.data?.itemCount ?? 0

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="relative mx-auto flex h-[72px] max-w-[480px] items-center justify-between rounded-t-[28px] bg-surface px-6 shadow-[0_-8px_24px_rgb(0_0_0/0.35)]">
        <Link to="/" className={itemClass} aria-current={pathname === '/' ? 'page' : undefined} aria-label="Início">
          <House className="size-6" aria-hidden="true" />
        </Link>
        <Link
          to="/perfil/favoritos"
          className={itemClass}
          aria-current={pathname === '/perfil/favoritos' ? 'page' : undefined}
          aria-label="Lista de interesse"
        >
          <Heart className="size-6" aria-hidden="true" />
        </Link>
        <Link
          to="/"
          hash="catalogo"
          aria-label="Explorar catálogo"
          className="-mt-12 grid size-16 place-items-center rounded-full border-4 border-ink bg-gradient-to-br from-copper/60 to-copper text-ink shadow-lg"
        >
          <ScanSearch className="size-7" aria-hidden="true" />
        </Link>
        <Link
          to="/carrinho"
          className={cn(itemClass, 'relative')}
          aria-current={pathname === '/carrinho' ? 'page' : undefined}
          aria-label={count > 0 ? `Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}` : 'Carrinho vazio'}
        >
          <ShoppingCart className="size-6" aria-hidden="true" />
          {count > 0 && (
            <span aria-hidden="true" className="absolute top-1.5 right-1 grid min-w-4 place-items-center rounded-full bg-copper px-0.5 text-[10px] font-medium text-ink">
              {count}
            </span>
          )}
        </Link>
        <Link
          to={user ? '/perfil' : '/entrar'}
          className={itemClass}
          aria-current={pathname.startsWith('/perfil') && pathname !== '/perfil/favoritos' ? 'page' : undefined}
          aria-label={user ? 'Meu perfil' : 'Entrar'}
        >
          <User className="size-6" aria-hidden="true" />
        </Link>
      </div>
    </nav>
  )
}

/** Barra superior das telas mobile com voltar + título (frames de carrinho e pagamento). */
export function MobileTopBar({ title, action, fallback = '/' }: { title: ReactNode; action?: ReactNode; fallback?: string }) {
  const router = useRouter()
  return (
    <div className="flex items-center gap-3 px-4 pt-6 pb-4 md:hidden">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? router.history.back() : void router.navigate({ to: fallback }))}
        className="grid size-9 shrink-0 place-items-center rounded-full border border-line-strong bg-surface-raised text-copper-bright"
        aria-label="Voltar"
      >
        <ChevronLeft className="size-5" aria-hidden="true" />
      </button>
      <h1 className="flex-1 truncate text-center text-xl font-bold">{title}</h1>
      <div className="flex size-9 shrink-0 items-center justify-center">{action}</div>
    </div>
  )
}
