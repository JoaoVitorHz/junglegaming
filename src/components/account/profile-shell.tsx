import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Download, Heart, LifeBuoy, LogOut, MapPin, ShoppingCart, Tag, User } from 'lucide-react'
import type { ReactNode } from 'react'
import { useLogout } from '@/auth/use-auth'
import { ComingSoon } from '@/components/layout/coming-soon'
import { cn } from '@/lib/utils'

const itemClass =
  'relative flex h-[45px] items-center gap-3 px-4 text-[15px] whitespace-nowrap text-copper-bright transition-colors hover:bg-surface-raised aria-[current=page]:before:absolute aria-[current=page]:before:inset-y-0 aria-[current=page]:before:left-0 aria-[current=page]:before:w-[5px] aria-[current=page]:before:bg-copper'

const links = [
  { to: '/perfil', label: 'Dados do perfil', Icon: User },
  { to: '/perfil/carteiras', label: 'Carteiras', Icon: MapPin },
] as const

const soon = [
  { label: 'Atividade', Icon: ShoppingCart },
  { label: 'Ofertas', Icon: Tag },
  { label: 'Arquivos baixados', Icon: Download },
  { label: 'Suporte', Icon: LifeBuoy },
]

/** Layout das páginas da conta (sidebar "Meu perfil" do Figma). */
export function ProfileShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const logout = useLogout()
  const navigate = useNavigate()

  return (
    <div className="container-page flex flex-col gap-6 pt-6 md:flex-row md:gap-7 md:pt-8">
      <nav aria-label="Minha conta" className="shrink-0 bg-surface md:w-[310px] md:self-start">
        <p className="hidden px-2.5 pt-4 pb-2 text-lg font-bold md:block">Meu perfil</p>
        <ul className="flex overflow-x-auto md:flex-col md:overflow-visible">
          {links.map(({ to, label, Icon }) => (
            <li key={to}>
              <Link activeOptions={{ exact: true }} to={to} className={itemClass} aria-current={pathname === to ? 'page' : undefined}>
                <Icon className="size-[18px]" aria-hidden="true" /> {label}
              </Link>
            </li>
          ))}
          <li>
            <Link activeOptions={{ exact: true }} to="/perfil/favoritos" className={itemClass} aria-current={pathname === '/perfil/favoritos' ? 'page' : undefined}>
              <Heart className="size-[18px]" aria-hidden="true" /> Lista de interesse
            </Link>
          </li>
          {soon.map(({ label, Icon }) => (
            <li key={label} className="max-md:hidden">
              <ComingSoon className={cn(itemClass, 'w-full')}>
                <Icon className="size-[18px]" aria-hidden="true" /> {label}
              </ComingSoon>
            </li>
          ))}
          <li className="md:border-t md:border-line">
            <button
              type="button"
              className={cn(itemClass, 'w-full font-bold')}
              onClick={() => logout.mutate(undefined, { onSettled: () => void navigate({ to: '/' }) })}
              disabled={logout.isPending}
            >
              <LogOut className="size-[18px]" aria-hidden="true" /> Sair
            </button>
          </li>
        </ul>
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
