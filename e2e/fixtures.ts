import { test as base, expect, type Page } from '@playwright/test'

export const USERS = {
  nova: { email: 'colecionador@kurio.dev', password: 'Kurio@2026', displayName: 'Nova Sato' },
  teo: { email: 'artista@kurio.dev', password: 'Kurio@2026', displayName: 'Téo Mint' },
} as const

type Presets = string[]

/**
 * Controle da simulação. Tudo passa pela camada de rede do app (MSW):
 * REST pelos handlers e eventos pelo servidor Socket.IO simulado, que os
 * entrega ao `socket.io-client` da aplicação.
 */
export class MockControl {
  constructor(private readonly page: Page) {}

  private async call<T = unknown>(path: string, body: unknown = {}, method = 'POST'): Promise<T> {
    return this.page.evaluate(
      async ({ path, body, method }) => {
        const session = JSON.parse(localStorage.getItem('kurio:session') ?? 'null') as { token?: string } | null
        const cartId = JSON.parse(localStorage.getItem('kurio:guest-cart') ?? 'null') as string | null
        const res = await fetch(`/api${path}`, {
          method,
          headers: {
            'content-type': 'application/json',
            ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
            ...(cartId ? { 'X-Cart-Id': cartId } : {}),
          },
          body: method === 'GET' ? undefined : JSON.stringify(body),
        })
        return res.json()
      },
      { path, body, method },
    ) as Promise<T>
  }

  setScenario(presets: Presets) {
    return this.call('/__mock/scenario', { presets }, 'PUT')
  }

  updateNft(change: { slug?: string; fromCart?: boolean; priceDelta?: string; price?: string; soldOut?: boolean; editions?: { id: string; available: number }[] }) {
    return this.call<{ event: { id: string; version: number } }>('/__mock/nft-update', change)
  }

  replayEvent(body: { eventId?: string; mode?: 'last' | 'stale' }) {
    return this.call('/__mock/replay-event', body)
  }

  disconnectSocket(blockMs = 0) {
    return this.call('/__mock/socket/disconnect', { blockMs })
  }

  expireSession() {
    return this.call('/__mock/expire-session')
  }

  orders() {
    return this.call<{ items: { id: string; status: string }[] }>('/orders', undefined, 'GET')
  }

  state() {
    return this.call<{ sockets: number; presets: string[] }>('/__mock/state', undefined, 'GET')
  }
}

export class App {
  readonly mock: MockControl
  constructor(readonly page: Page) {
    this.mock = new MockControl(page)
  }

  /** Navega e espera a camada de mocks estar ativa. */
  async goto(path: string) {
    await this.page.goto(path)
    await this.page.waitForSelector('html[data-mocks=ready]')
  }

  /** Autentica pela API (mesmo contrato do formulário) e recarrega: sessão recuperada após refresh. */
  async loginAs(user: keyof typeof USERS, path = '/') {
    if (!(await this.page.evaluate(() => document.documentElement.dataset.mocks === 'ready').catch(() => false))) {
      await this.goto('/')
    }
    await this.page.evaluate(async ({ email, password }) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'X-Cart-Id': JSON.parse(localStorage.getItem('kurio:guest-cart') ?? '""') },
        body: JSON.stringify({ email, password }),
      })
      const session = await res.json()
      localStorage.setItem('kurio:session', JSON.stringify(session))
    }, USERS[user])
    await this.goto(path)
  }

  async addToCart(slug: string, quantity = 1) {
    await this.goto(`/nft/${slug}`)
    const isMobile = (this.page.viewportSize()?.width ?? 1440) < 768
    for (let i = 1; i < quantity; i++) {
      await this.page.getByRole('button', { name: /Aumentar quantidade/ }).filter({ visible: true }).first().click()
    }
    await this.page.getByRole('button', { name: isMobile ? 'Comprar NFT' : 'COMPRAR', exact: true }).click()
    await this.page.waitForURL('**/carrinho')
  }

  get isMobile() {
    return (this.page.viewportSize()?.width ?? 1440) < 768
  }
}

export const test = base.extend<{ app: App; presets: Presets }>({
  presets: [['instant'], { option: true }],
  app: async ({ page, presets }, use) => {
    // Cenário definido antes de qualquer script da página: estado isolado e determinístico.
    await page.addInitScript((ids) => {
      if (!sessionStorage.getItem('kurio:e2e-init')) {
        sessionStorage.setItem('kurio:e2e-init', '1')
        localStorage.setItem('kurio:mock:scenario', JSON.stringify(ids))
      }
    }, presets)
    await use(new App(page))
  },
})

export { expect }
