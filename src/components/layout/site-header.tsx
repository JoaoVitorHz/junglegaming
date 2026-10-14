import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Heart, LogIn, LogOut, Search, ShoppingCart, User, Wallet, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useLogout } from '@/auth/use-auth'
import { useCurrentUser } from '@/auth/use-session'
import { UserAvatar } from '@/components/account/user-avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useCart } from '@/queries/cart'
import { ComingSoon } from './coming-soon'

const navLinkBase =
  'relative flex h-[45px] items-start pt-0 text-base transition-colors hover:text-copper-bright after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:rounded-full after:bg-copper after:opacity-0 after:transition-opacity'
const navLinkActive = 'font-bold text-copper-bright after:opacity-100'

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('text-sm font-bold tracking-[0.1em] text-cream', className)} aria-label="Kurio, página inicial">
      KURIO
    </Link>
  )
}

export function CartLink({ className }: { className?: string }) {
  const cart = useCart()
  const count = cart.data?.itemCount ?? 0
  return (
    <Link
      to="/carrinho"
      className={cn('relative inline-flex size-10 items-center justify-center rounded-md hover:text-copper-bright', className)}
      aria-label={count > 0 ? `Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}` : 'Carrinho vazio'}
    >
      <ShoppingCart className="size-6" aria-hidden="true" />
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute top-0.5 right-0 grid min-w-4 place-items-center rounded-full border-2 border-ink bg-copper px-0.5 text-[10px] leading-3 font-medium text-ink"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}

function HeaderSearch() {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const id = useId()

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  function close() {
    setOpen(false)
    buttonRef.current?.focus()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const q = value.trim()
    void navigate({ to: '/', search: q ? { q } : {}, hash: 'catalogo' })
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex size-10 items-center justify-center rounded-md hover:text-copper-bright"
        aria-label="Buscar NFTs"
        aria-expanded={false}
        aria-controls={id}
      >
        <Search className="size-5" aria-hidden="true" />
      </button>
    )
  }

  return (
    <form id={id} role="search" onSubmit={submit} className="flex items-center gap-1">
      <label htmlFor={`${id}-input`} className="sr-only">
        Buscar NFTs, coleções ou atributos
      </label>
      <Input
        ref={inputRef}
        id={`${id}-input`}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && close()}
        placeholder="Buscar NFTs…"
        className="h-9 w-40 sm:w-56"
      />
      <Button type="submit" size="icon-sm" aria-label="Buscar">
        <Search aria-hidden="true" />
      </Button>
      <Button type="button" size="icon-sm" variant="ghost" onClick={close} aria-label="Fechar busca">
        <X aria-hidden="true" />
      </Button>
    </form>
  )
}

function AccountMenu() {
  const user = useCurrentUser()
  const logout = useLogout()
  const navigate = useNavigate()
  const href = useRouterState({ select: (s) => s.location.href })

  if (!user) {
    return (
      <Button asChild className="h-[35px] gap-1 px-2.5 text-base font-medium">
        <Link to="/entrar" search={{ redirect: href.startsWith('/entrar') || href.startsWith('/cadastro') ? undefined : href }}>
          <LogIn className="size-5" aria-hidden="true" />
          Entrar
        </Link>
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md px-1 py-1 hover:text-copper-bright"
          aria-label={`Conta de ${user.displayName}`}
        >
          <UserAvatar user={user} className="size-8" />
          <span className="hidden max-w-32 truncate text-sm lg:inline">{user.displayName}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">@{user.username}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/perfil">
            <User aria-hidden="true" /> Meu perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/perfil/carteiras">
            <Wallet aria-hidden="true" /> Carteiras
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/perfil/favoritos">
            <Heart aria-hidden="true" /> Lista de interesse
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() =>
            logout.mutate(undefined, {
              onSettled: () => void navigate({ to: '/' }),
            })
          }
        >
          <LogOut aria-hidden="true" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function SiteHeader({ className }: { className?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const marketActive = pathname.startsWith('/nft') || pathname === '/carrinho' || pathname === '/pagamento'

  return (
    <header className={cn('container-page pt-6', className)}>
      <div className="flex items-start justify-between gap-4 border-b border-copper/30">
        <div className="flex h-[45px] w-40 items-start pt-2">
          <Logo />
        </div>
        <nav aria-label="Principal" className="hidden md:block">
          <ul className="flex gap-10">
            <li>
              <Link to="/" className={cn(navLinkBase, pathname === '/' && navLinkActive)} aria-current={pathname === '/' ? 'page' : undefined}>
                Início
              </Link>
            </li>
            <li>
              <Link to="/" hash="catalogo" className={cn(navLinkBase, marketActive && navLinkActive)}>
                Mercado
              </Link>
            </li>
            <li>
              <ComingSoon className={navLinkBase}>Criadores</ComingSoon>
            </li>
            <li>
              <ComingSoon className={navLinkBase}>Aprenda</ComingSoon>
            </li>
          </ul>
        </nav>
        <div className="flex h-[45px] items-start justify-end gap-3 sm:gap-5">
          <HeaderSearch />
          <CartLink />
          <AccountMenu />
        </div>
      </div>
    </header>
  )
}
