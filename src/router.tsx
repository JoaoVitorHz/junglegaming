import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
} from '@tanstack/react-router'
import { sessionStore } from '@/auth/session-store'
import { AppLayout } from '@/components/layout/app-layout'
// Páginas de entrada (Início e Detalhe) no bundle principal: evita um salto extra
// na cadeia de carregamento até o LCP. As demais rotas são carregadas sob demanda.
import { HomePage } from '@/pages/home-page'
import { NftDetailPage } from '@/pages/nft-detail-page'
import { NotFoundPage } from '@/pages/not-found-page'
import { RouteErrorPage } from '@/pages/route-error-page'
import { authSearchSchema, catalogSearchSchema } from '@/routes/search'

export interface RouterContext {
  queryClient: QueryClient
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: AppLayout,
  notFoundComponent: () => <NotFoundPage />,
  errorComponent: RouteErrorPage,
})

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: (search) => catalogSearchSchema.parse(search),
  component: HomePage,
})

const nftRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/nft/$slug',
  component: NftDetailPage,
})

const cartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/carrinho',
  component: lazyRouteComponent(() => import('@/pages/cart-page'), 'CartPage'),
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/entrar',
  validateSearch: (search) => authSearchSchema.parse(search),
  component: lazyRouteComponent(() => import('@/pages/auth-page'), 'LoginPage'),
})

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cadastro',
  validateSearch: (search) => authSearchSchema.parse(search),
  component: lazyRouteComponent(() => import('@/pages/auth-page'), 'RegisterPage'),
})

/** Layout sem path que protege os fluxos privados. */
const authedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'authed',
  beforeLoad: ({ location }) => {
    const state = sessionStore.getState()
    if (state.status !== 'authenticated') {
      throw redirect({
        to: '/entrar',
        search: { redirect: location.href, reason: state.status === 'expired' ? 'expired' : 'required' },
      })
    }
  },
  component: lazyRouteComponent(() => import('@/components/layout/authed-layout'), 'AuthedLayout'),
})

const checkoutRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/pagamento',
  component: lazyRouteComponent(() => import('@/pages/checkout-page'), 'CheckoutPage'),
})

const orderRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/pedidos/$orderId',
  component: lazyRouteComponent(() => import('@/pages/order-page'), 'OrderPage'),
})

const profileRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/perfil',
  component: lazyRouteComponent(() => import('@/pages/profile-page'), 'ProfilePage'),
})

const walletsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/perfil/carteiras',
  component: lazyRouteComponent(() => import('@/pages/wallets-page'), 'WalletsPage'),
})

const favoritesRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/perfil/favoritos',
  component: lazyRouteComponent(() => import('@/pages/favorites-page'), 'FavoritesPage'),
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  nftRoute,
  cartRoute,
  loginRoute,
  registerRoute,
  authedRoute.addChildren([checkoutRoute, orderRoute, profileRoute, walletsRoute, favoritesRoute]),
])

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
