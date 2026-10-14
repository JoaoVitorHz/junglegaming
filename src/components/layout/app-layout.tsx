import { Outlet, useRouterState } from '@tanstack/react-router'
import { WifiOff } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { cn } from '@/lib/utils'
import { useRealtimeStatus } from '@/realtime/realtime-status'
import { MobileNav } from './mobile-nav'
import { SiteFooter } from './site-footer'
import { SiteHeader } from './site-header'

const MockPanel = import.meta.env.VITE_ENABLE_MOCKS === 'true' ? lazy(() => import('@/mocks/ui/mock-panel')) : null

/** Telas que têm barra própria no mobile (frames mobile do Figma). */
const OWN_MOBILE_CHROME = [/^\/$/, /^\/nft\//, /^\/carrinho$/, /^\/pagamento$/, /^\/entrar$/, /^\/cadastro$/]
/** Telas com barra de ação fixa no rodapé do mobile (sem a navegação inferior). */
const NO_MOBILE_NAV = [/^\/nft\//, /^\/carrinho$/, /^\/pagamento$/, /^\/entrar$/, /^\/cadastro$/]

function RealtimeBanner() {
  const status = useRealtimeStatus()
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-2 z-50 flex justify-center">
      {status === 'reconnecting' && (
        <p className="pointer-events-auto flex items-center gap-2 rounded-full border border-line-strong bg-surface px-4 py-1.5 text-xs text-sand shadow-lg">
          <WifiOff className="size-3.5 text-copper-bright" aria-hidden="true" />
          Reconectando às atualizações em tempo real…
        </p>
      )}
    </div>
  )
}

export function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const ownMobileChrome = OWN_MOBILE_CHROME.some((re) => re.test(pathname))
  const hideMobileNav = NO_MOBILE_NAV.some((re) => re.test(pathname))

  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-md bg-copper px-4 py-2 font-bold text-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Pular para o conteúdo
      </a>
      <SiteHeader className={cn(ownMobileChrome && 'max-md:hidden')} />
      {/* Altura mínima: o footer começa abaixo da dobra e não "pula" quando o conteúdo carrega (CLS). */}
      <main id="conteudo" tabIndex={-1} className={cn('min-h-[calc(100dvh-5rem)] flex-1 outline-none', !hideMobileNav && 'max-md:pb-24')}>
        <Outlet />
      </main>
      <SiteFooter />
      {!hideMobileNav && <MobileNav />}
      <RealtimeBanner />
      {MockPanel && (
        <Suspense fallback={null}>
          <MockPanel />
        </Suspense>
      )}
    </div>
  )
}
