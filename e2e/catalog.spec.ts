import { expect, test } from './fixtures'

test.describe('Catálogo', () => {
  test('busca, filtros combinados, ordenação, paginação e restauração pelo histórico', async ({ app, page }) => {
    await app.goto('/')
    const results = page.getByText(/NFTs? encontrados?/).first()
    await expect(results).toHaveText('48 NFTs encontrados')

    // Paginação (9 por página)
    await page.getByRole('link', { name: 'Página 2' }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByRole('link', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')

    // Filtro de coleção reinicia a paginação
    const openFilters = async () => {
      if (app.isMobile) await page.getByRole('button', { name: /^Filtros/ }).click()
    }
    const closeFilters = async () => {
      if (app.isMobile) await page.keyboard.press('Escape')
    }
    await openFilters()
    await page.getByRole('button', { name: /Música/ }).click()
    await closeFilters()
    await expect(page).toHaveURL(/category=musica/)
    await expect(page).not.toHaveURL(/page=2/)
    await expect(results).toHaveText(/\d+ NFTs encontrados/)
    const musicCount = Number((await results.textContent())!.match(/\d+/)![0])

    // Combina com rede
    await openFilters()
    await page.getByRole('button', { name: /^Solana/ }).click()
    await closeFilters()
    await expect(page).toHaveURL(/network=solana/)
    await expect(async () => {
      const combined = Number((await results.textContent())!.match(/\d+/)![0])
      expect(combined).toBeLessThan(musicCount)
    }).toPass()

    // Ordenação por menor preço
    const sortTrigger = page.getByRole('combobox', { name: 'Ordenar por:' }).filter({ visible: true })
    await sortTrigger.click()
    await page.getByRole('option', { name: 'Menor preço' }).click()
    await expect(page).toHaveURL(/sort=price-asc/)
    const prices = await page.locator('article p span:not(.sr-only)').filter({ hasText: 'ETH' }).allTextContents()
    const values = prices.map((p) => Number.parseFloat(p))
    expect(values).toEqual([...values].sort((a, b) => a - b))

    // Busca textual (debounce) combinada aos filtros
    if (app.isMobile) {
      await page.getByRole('searchbox', { name: /Buscar NFTs/ }).fill('golden')
    } else {
      await page.getByRole('button', { name: 'Buscar NFTs' }).click()
      await page.getByRole('searchbox', { name: /Buscar NFTs/ }).fill('golden')
      await page.keyboard.press('Enter')
    }
    await expect(page).toHaveURL(/q=golden/)
    await expect(page).toHaveURL(/network=solana/)
    await expect(results).toHaveText(/para “golden”/)
    const searchCount = Number((await results.textContent())!.match(/\d+/)![0])
    const cards = page.locator('#catalogo article')
    await expect(cards).toHaveCount(searchCount)
    const urlWithSearch = page.url()

    // Histórico: volta e avança restauram o estado completo
    await page.goBack()
    await expect(page).not.toHaveURL(/q=golden/)
    await expect(page).toHaveURL(/sort=price-asc/)
    await page.goForward()
    await expect(page).toHaveURL(urlWithSearch)
    await expect(cards).toHaveCount(searchCount)

    // Refresh mantém tudo
    await page.reload()
    await expect(page).toHaveURL(urlWithSearch)
    await expect(cards).toHaveCount(searchCount)
    await openFilters()
    await expect(page.getByRole('button', { name: /Música/ }).first()).toHaveAttribute('aria-pressed', 'true')
  })

  test('resultado vazio e limpar filtros', async ({ app, page }) => {
    await app.goto('/?q=inexistente-xyz')
    await expect(page.getByText('Nenhum NFT encontrado')).toBeVisible()
    await page.getByRole('button', { name: 'Limpar busca e filtros' }).click()
    await expect(page.getByText('48 NFTs encontrados')).toBeVisible()
  })

  test('respostas fora de ordem não sobrescrevem a busca atual', async ({ app, page }) => {
    test.skip(app.isMobile, 'Coberto no desktop: mesmo código de consulta')
    await app.goto('/')
    await app.mock.setScenario(['out-of-order'])
    // "g" responde por último (latência maior que "golden"), mas foi descartada.
    await page.goto('/?q=g')
    await page.goto('/?q=golden')
    await page.waitForSelector('html[data-mocks=ready]')
    await expect(page.getByText(/2 NFTs encontrados para “golden”/)).toBeVisible()
    await page.waitForTimeout(1800)
    await expect(page.getByText(/2 NFTs encontrados para “golden”/)).toBeVisible()
  })
})

test.describe('Carregamento e falhas', () => {
  test.use({ presets: ['slow'] })

  test('skeletons com rede lenta no catálogo, detalhe e resumo do carrinho', async ({ app, page }) => {
    await page.goto('/')
    await expect(page.getByLabel('Carregando NFTs')).toBeVisible()
    await expect(page.getByLabel('Carregando NFTs').locator('.shimmer').first()).toBeVisible()
    await expect(page.getByText('48 NFTs encontrados')).toBeVisible({ timeout: 15_000 })

    await page.goto('/nft/emerald-ape-042')
    await expect(page.getByLabel('Carregando NFT')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible({ timeout: 15_000 })

    await page.goto('/carrinho')
    await expect(page.getByLabel('Carregando carrinho')).toBeVisible()
    await expect(page.getByText('Seu carrinho está vazio')).toBeVisible({ timeout: 15_000 })
    void app
  })
})

test.describe('Falha e recuperação', () => {
  test.use({ presets: ['instant', 'catalog-error'] })

  test('feedback de falha e recuperação após nova tentativa', async ({ app, page }) => {
    await app.goto('/')
    await expect(page.getByText('Não foi possível carregar o catálogo')).toBeVisible({ timeout: 15_000 })
    await app.mock.setScenario(['instant'])
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByText('48 NFTs encontrados')).toBeVisible()
  })
})

test.describe('Detalhe do NFT', () => {
  test('acesso direto, edição esgotada e limite de quantidade', async ({ app, page }) => {
    await app.goto('/nft/emerald-ape-042')
    await expect(page.getByRole('heading', { name: 'Emerald Ape #042', level: 1 })).toBeVisible()
    // Edição 1/1 esgotada
    await expect(page.getByRole('radio', { name: /1\/1 \(esgotada\)/ })).toBeDisabled()
    // 1/10 tem 4 disponíveis: o + para em 4
    await page.locator('label', { hasText: '1/10' }).click()
    const plus = page.getByRole('button', { name: /Aumentar quantidade/ }).filter({ visible: true }).first()
    for (let i = 0; i < 5; i++) if (await plus.isEnabled()) await plus.click()
    await expect(page.getByRole('status', { name: 'Quantidade de Emerald Ape #042' }).filter({ visible: true })).toHaveText('4')
    await expect(plus).toBeDisabled()
  })

  test('NFT inexistente mostra 404', async ({ app, page }) => {
    await app.goto('/nft/nao-existe-123')
    await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()
    await page.getByRole('link', { name: 'Voltar para o início' }).click()
    await expect(page).toHaveURL('/')
  })

  test('rota inexistente mostra 404', async ({ app, page }) => {
    await app.goto('/rota/que/nao/existe')
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  })
})
