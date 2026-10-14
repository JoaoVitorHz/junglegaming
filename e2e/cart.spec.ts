import { expect, test } from './fixtures'

const total = (page: import('@playwright/test').Page) =>
  page.getByRole('complementary', { name: 'Resumo da carteira' }).locator('dd').last()

test.describe('Carrinho', () => {
  test('quantidades, remoção, cupom e persistência após refresh e login', async ({ app, page }) => {
    // Visitante adiciona itens
    await app.addToCart('emerald-ape-042')
    await app.addToCart('violet-nomad-314')
    await expect(page.getByRole('link', { name: 'Emerald Ape #042' })).toBeVisible()
    await expect(total(page)).toHaveText('2.596 ETH') // 1.19 + 1.39 + 0.016

    // Quantidade
    await page.getByRole('button', { name: 'Aumentar quantidade de Emerald Ape #042' }).click()
    await expect(total(page)).toHaveText('3.786 ETH')

    // Cupom inválido, expirado e válido
    const coupon = page.getByPlaceholder('Digite o código promocional...')
    await coupon.fill('NAOEXISTE')
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Código promocional inválido.' })).toBeVisible()
    await coupon.fill('LANCAMENTO5')
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'expirou' })).toBeVisible()
    await coupon.fill('KURIO10')
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
    await expect(page.getByText(/Cupom KURIO10 ·/)).toBeVisible()
    await expect(total(page)).toHaveText('3.409 ETH') // (2.38 + 1.39) * 0.9 + 0.016

    // Remoção
    const remove = app.isMobile
      ? page.getByRole('listitem').filter({ hasText: 'Violet Nomad #314' }).getByRole('button', { name: 'Remover' })
      : page.getByRole('button', { name: 'Remover Violet Nomad #314 do carrinho' })
    await remove.click()
    await expect(page.getByRole('link', { name: 'Violet Nomad #314' })).toHaveCount(0)
    await expect(total(page)).toHaveText('2.158 ETH') // 2.38 * 0.9 + 0.016

    // Persistência após refresh
    await page.reload()
    await expect(page.getByRole('link', { name: 'Emerald Ape #042' })).toBeVisible()
    await expect(total(page)).toHaveText('2.158 ETH')

    // Login preserva os itens do visitante
    await page.goto('/entrar?redirect=/carrinho')
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('textbox', { name: /E-mail/ }).fill('colecionador@kurio.dev')
    await dialog.getByRole('textbox', { name: 'Senha (obrigatório)', exact: true }).fill('Kurio@2026')
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL('/carrinho')
    await expect(page.getByRole('link', { name: 'Emerald Ape #042' })).toBeVisible()
    await expect(page.getByRole('status', { name: 'Quantidade de Emerald Ape #042' })).toHaveText('2')
  })

  test('remover cupom e carrinho vazio', async ({ app, page }) => {
    await app.addToCart('golden-beat-207')
    const coupon = page.getByPlaceholder('Digite o código promocional...')
    await coupon.fill('GENESIS20')
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
    await page.getByRole('button', { name: 'Remover cupom GENESIS20' }).click()
    await expect(total(page)).toHaveText('1.006 ETH')
    const remove = app.isMobile
      ? page.getByRole('button', { name: 'Remover', exact: true })
      : page.getByRole('button', { name: 'Remover Golden Beat #207 do carrinho' })
    await remove.click()
    await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
  })
})

test.describe('Favoritos', () => {
  test('favoritar é otimista e persiste por usuário', async ({ app, page }) => {
    await app.loginAs('nova', '/nft/golden-signal-160')
    const fav = page.getByRole('button', { name: /lista de interesse|Favoritar|Favoritado/ }).filter({ visible: true }).first()
    await expect(fav).toHaveAttribute('aria-pressed', 'false')
    await fav.click()
    await expect(fav).toHaveAttribute('aria-pressed', 'true')
    await page.reload()
    await expect(page.getByRole('button', { name: /lista de interesse|Favoritar|Favoritado/ }).filter({ visible: true }).first()).toHaveAttribute('aria-pressed', 'true')
    await app.goto('/perfil/favoritos')
    await expect(page.getByRole('article').getByText('Golden Signal #160')).toBeVisible()
  })

  test('falha na mutation faz rollback e recupera depois', async ({ app, page }) => {
    await app.loginAs('nova', '/nft/golden-signal-160')
    await app.mock.setScenario(['instant', 'favorites-fail'])
    const fav = () => page.getByRole('button', { name: /lista de interesse|Favoritar|Favoritado/ }).filter({ visible: true }).first()
    await fav().click()
    await expect(page.getByText(/Não foi possível favoritar Golden Signal #160/)).toBeVisible()
    await expect(fav()).toHaveAttribute('aria-pressed', 'false')

    await app.mock.setScenario(['instant'])
    await fav().click()
    await expect(fav()).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText(/adicionado à lista de interesse/)).toBeVisible()
  })

  test('visitante é levado ao login ao favoritar', async ({ app, page }) => {
    await app.goto('/nft/golden-signal-160')
    await page.getByRole('button', { name: /lista de interesse|Favoritar/ }).filter({ visible: true }).first().click()
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fnft%2Fgolden-signal-160/)
  })
})
