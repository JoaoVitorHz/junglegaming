import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

/**
 * Regressão visual com dados estáveis (seed + cenário "instant").
 * Baselines versionadas em e2e/visual.spec.ts-snapshots/ (geradas no
 * Windows/Chromium; em outro SO, regenere com `npm run test:e2e:update`).
 */
async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready)
  // Imagens lazy fora da tela também precisam estar no screenshot de página inteira.
  await page.evaluate(() => document.querySelectorAll('img[loading=lazy]').forEach((img) => ((img as HTMLImageElement).loading = 'eager')))
  await page.waitForFunction(() =>
    [...document.images].filter((img) => img.getClientRects().length > 0).every((img) => img.complete && img.naturalWidth > 0),
  )
  await page.waitForLoadState('networkidle')
  await page.addStyleTag({ content: '[data-sonner-toaster]{display:none!important}' })
}

const hideDevtools = (page: Page) => [page.getByRole('button', { name: 'Abrir painel de simulação' })]

test.describe('Regressão visual', () => {
  test('início', async ({ app, page }) => {
    await app.goto('/')
    await expect(page.getByText('48 NFTs encontrados')).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('inicio.png', { fullPage: true, mask: hideDevtools(page) })
  })

  test('detalhe do NFT', async ({ app, page }) => {
    await app.goto('/nft/emerald-ape-042')
    await expect(page.getByRole('heading', { name: 'Emerald Ape #042', level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: /Amber|Crimson|Echo|Bronze|Rustic/ }).first()).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('detalhe.png', { fullPage: true, mask: hideDevtools(page) })
  })

  test('carrinho', async ({ app, page }) => {
    await app.addToCart('emerald-ape-042')
    await app.addToCart('violet-nomad-314')
    await settle(page)
    await expect(page).toHaveScreenshot('carrinho.png', { fullPage: true, mask: hideDevtools(page) })
  })

  test('pagamento', async ({ app, page }) => {
    await app.loginAs('nova')
    await app.addToCart('emerald-ape-042')
    await app.goto('/pagamento')
    await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('pagamento.png', { fullPage: true, mask: hideDevtools(page) })
  })
})
