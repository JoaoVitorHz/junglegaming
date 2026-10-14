import { expect, test } from './fixtures'

test.describe('Acessibilidade', () => {
  test('navegação por teclado com skip link e foco visível', async ({ app, page }) => {
    test.skip(app.isMobile, 'Navegação por teclado avaliada no desktop')
    await app.goto('/')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeAttached()
    await expect(page.getByRole('article').first()).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(skip).toBeFocused()
    await expect(skip).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(page.locator('#conteudo')).toBeFocused()

    // Foco visível em links do cabeçalho
    await app.goto('/')
    await expect(page.getByRole('article').first()).toBeVisible()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    const focused = page.locator(':focus-visible')
    await expect(focused).toHaveCount(1)
    const outline = await focused.evaluate((el) => getComputedStyle(el).outlineStyle)
    expect(outline).not.toBe('none')

    // Acessa um NFT só com teclado
    const link = page.getByRole('link', { name: 'Emerald Ape #042' }).first()
    await link.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL('/nft/emerald-ape-042')
  })

  test('diálogo de login prende o foco e fecha com Escape', async ({ app, page }) => {
    await app.goto('/entrar')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
    }
    // Esc fecha a camada do topo (um tooltip aberto fecharia primeiro); a partir de um campo, fecha o diálogo.
    await dialog.getByRole('textbox', { name: /E-mail/ }).focus()
    // Um tooltip aberto (botões 'em breve') fecha no primeiro Esc; o seguinte fecha o diálogo.
    await expect(async () => {
      await page.keyboard.press('Escape')
      await expect(page).toHaveURL('/', { timeout: 500 })
    }).toPass({ timeout: 5000 })
  })

  test('drawer de filtros controla o foco no mobile', async ({ app, page }) => {
    test.skip(!app.isMobile, 'Drawer só existe no mobile')
    await app.goto('/')
    const trigger = page.getByRole('button', { name: /^Filtros/ })
    await trigger.click()
    const sheet = page.getByRole('dialog', { name: 'Filtros' })
    await expect(sheet).toBeVisible()
    expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })

  test('erros de formulário associados aos campos e anunciados', async ({ app, page }) => {
    await app.goto('/entrar')
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
    const email = dialog.getByRole('textbox', { name: /E-mail/ })
    await expect(email).toBeFocused()
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(email).toHaveAccessibleDescription('Informe um e-mail válido')
    await email.fill('colecionador@kurio.dev')
    await expect(email).not.toHaveAttribute('aria-invalid', 'true')
  })

  test('imagens relevantes têm texto alternativo e não há overflow horizontal', async ({ app, page }) => {
    await app.goto('/')
    await expect(page.getByRole('article').first()).toBeVisible()
    const missingAlt = await page.locator('img:not([alt])').count()
    expect(missingAlt).toBe(0)
    await expect(page.getByRole('img', { name: /Emerald Ape #042: Ilustração/ }).first()).toBeAttached()
    for (const path of ['/', '/nft/emerald-ape-042', '/carrinho', '/entrar']) {
      await app.goto(path)
      await page.waitForTimeout(300)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow, `overflow em ${path}`).toBeLessThanOrEqual(0)
    }
  })

  test('tablet (768 px): sem overflow e controles principais visíveis', async ({ app, page }) => {
    test.skip(app.isMobile, 'Viewport próprio')
    await page.setViewportSize({ width: 768, height: 1024 })
    for (const path of ['/', '/nft/emerald-ape-042', '/carrinho', '/entrar']) {
      await app.goto(path)
      await page.waitForTimeout(300)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow, 'overflow em ' + path).toBeLessThanOrEqual(0)
    }
    await app.goto('/nft/emerald-ape-042')
    await expect(page.getByRole('button', { name: 'COMPRAR', exact: true })).toBeInViewport({ ratio: 1 }).catch(async () => {
      await page.getByRole('button', { name: 'COMPRAR', exact: true }).scrollIntoViewIfNeeded()
      await expect(page.getByRole('button', { name: 'COMPRAR', exact: true })).toBeInViewport({ ratio: 1 })
    })
    await expect(page.getByRole('button', { name: /Favoritar/ })).toBeVisible()
  })

  test('alterações em tempo real são anunciadas', async ({ app, page }) => {
    await app.addToCart('emerald-ape-042')
    await app.mock.updateNft({ fromCart: true, priceDelta: '0.05' })
    // Toasts do sonner usam região aria-live
    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /O preço de Emerald Ape #042 mudou/ })
    await expect(toast).toBeVisible()
    await expect(page.locator('section[aria-live], [aria-live]').first()).toBeAttached()
  })
})
