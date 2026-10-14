import type { Page } from '@playwright/test'
import { expect, test, type App } from './fixtures'

async function goToReview(app: App, page: Page) {
  await app.goto('/carrinho')
  await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
  await expect(page).toHaveURL('/pagamento')
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  const review = page.getByRole('dialog', { name: 'Revise seu pedido' })
  await expect(review).toBeVisible()
  return review
}

test.describe('Compra', () => {
  test('compra completa: do catálogo ao recibo confirmado', async ({ app, page }) => {
    await app.loginAs('nova')
    await page.getByRole('link', { name: 'Emerald Ape #042' }).first().click()
    await expect(page).toHaveURL('/nft/emerald-ape-042')
    await page.getByRole('button', { name: app.isMobile ? 'Comprar NFT' : 'COMPRAR', exact: true }).click()
    await app.addToCart('violet-nomad-314', 2)

    const review = await goToReview(app, page)
    await expect(review.getByText('Emerald Ape #042')).toBeVisible()
    await expect(review.getByText('3.986 ETH').first()).toBeVisible() // 1.19 + 2×1.39 + 0.016
    await review.getByRole('button', { name: /Confirmar e pagar/ }).click()

    await expect(page).toHaveURL(/\/pedidos\/ord_/)
    const receipt = page.getByRole('dialog', { name: 'Seus NFTs agora estão na sua carteira' })
    await expect(receipt).toBeVisible()
    await expect(receipt.getByText('Violet Nomad #314')).toBeVisible()
    await expect(receipt.getByText('3.986 ETH').first()).toBeVisible()
    await expect(receipt.getByText('MetaMask')).toBeVisible()

    // Itens comprados saíram do carrinho
    await app.goto('/carrinho')
    await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
    const { items } = await app.mock.orders()
    expect(items).toHaveLength(1)
    expect(items[0]?.status).toBe('confirmed')
  })

  test('validação do formulário de pagamento', async ({ app, page }) => {
    test.skip(app.isMobile, 'Formulário recolhido no mobile; validação idêntica')
    await app.loginAs('nova')
    await app.addToCart('golden-beat-207')
    await app.goto('/pagamento')
    await page.getByRole('checkbox', { name: 'Usar outra carteira?' }).check()
    await page.getByRole('textbox', { name: /Código de indicação/ }).fill('!')
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    const address = page.getByRole('textbox', { name: /Endereço da carteira/ })
    await expect(address).toHaveAttribute('aria-invalid', 'true')
    await expect(address).toBeFocused()
    await expect(page.getByText('Informe um endereço 0x com 40 caracteres hexadecimais')).toBeVisible()
    await expect(page.getByText('Use de 4 a 12 letras ou números')).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})

test.describe('Falhas de pagamento', () => {
  test('pagamento recusado preserva o carrinho', async ({ app, page }) => {
    await app.loginAs('nova')
    await app.mock.setScenario(['instant', 'payment-rejected'])
    await app.addToCart('golden-beat-207')
    const review = await goToReview(app, page)
    await review.getByRole('button', { name: /Confirmar e pagar/ }).click()
    await expect(page.getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible()
    await expect(page).toHaveURL('/pagamento')
    await page.getByRole('link', { name: 'Voltar ao carrinho' }).click()
    await expect(page.getByRole('link', { name: 'Golden Beat #207' })).toBeVisible()
  })

  test('clique repetido cria um único pedido', async ({ app, page }) => {
    await app.loginAs('nova')
    await app.mock.setScenario(['instant', 'slow-settlement'])
    await app.addToCart('golden-beat-207')
    const review = await goToReview(app, page)
    const confirm = review.getByRole('button', { name: /Confirmar e pagar/ })
    await confirm.dblclick({ force: true })
    await confirm.click({ force: true, timeout: 1000 }).catch(() => {})
    await expect(page.getByText('Aguardando confirmação da rede…')).toBeVisible()
    const { items } = await app.mock.orders()
    expect(items).toHaveLength(1)
  })

  test('timeout após criar o pedido recupera o mesmo pedido pela chave de idempotência', async ({ app, page }) => {
    test.setTimeout(90_000)
    await app.loginAs('nova')
    await app.mock.setScenario(['instant', 'order-timeout'])
    await app.addToCart('golden-beat-207')
    const review = await goToReview(app, page)
    await review.getByRole('button', { name: /Confirmar e pagar/ }).click()
    await expect(page).toHaveURL(/\/pedidos\/ord_/, { timeout: 30_000 })
    const { items } = await app.mock.orders()
    expect(items).toHaveLength(1)
    expect(items[0]?.status).toBe('confirmed')
  })

  test('carteira recusa a conexão', async ({ app, page }) => {
    await app.loginAs('nova')
    await app.mock.setScenario(['instant', 'wallet-rejected'])
    await app.addToCart('golden-beat-207')
    await app.goto('/pagamento')
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.getByText('Conexão recusada na carteira')).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('expiração de sessão no checkout preserva o contexto', async ({ app, page }) => {
    test.skip(app.isMobile, 'Formulário recolhido no mobile')
    await app.loginAs('nova')
    await app.addToCart('golden-beat-207')
    await app.goto('/pagamento')
    await page.getByRole('textbox', { name: /Observação do colecionador/ }).fill('Presente de aniversário')
    await app.mock.expireSession()
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fpagamento&reason=expired/)
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('textbox', { name: /E-mail/ }).fill('colecionador@kurio.dev')
    await dialog.getByRole('textbox', { name: 'Senha (obrigatório)', exact: true }).fill('Kurio@2026')
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL('/pagamento')
    await expect(page.getByRole('textbox', { name: /Observação do colecionador/ })).toHaveValue('Presente de aniversário')
  })
})

test.describe('Tempo real (Socket.IO)', () => {
  test('alteração de preço durante o checkout exige nova confirmação', async ({ app, page }) => {
    await app.loginAs('nova')
    await app.addToCart('emerald-ape-042')
    const review = await goToReview(app, page)
    await expect(review.getByRole('button', { name: /Confirmar e pagar 1.206 ETH/ })).toBeEnabled()

    // Evento nft.updated emitido pelo servidor simulado → socket.io-client do app
    await app.mock.updateNft({ fromCart: true, priceDelta: '0.15' })
    await expect(page.getByText(/O preço de Emerald Ape #042 mudou de 1.19 ETH para 1.34 ETH/)).toBeVisible()
    await expect(review.getByText('Esta cotação está desatualizada')).toBeVisible()
    await expect(review.getByRole('button', { name: /Confirmar e pagar/ })).toBeDisabled()

    await review.getByRole('button', { name: 'Atualizar valores' }).click()
    await expect(review.getByText(/Os valores foram atualizados/)).toBeVisible()
    await review.getByRole('button', { name: /Confirmar e pagar 1.356 ETH/ }).click()
    await expect(page).toHaveURL(/\/pedidos\/ord_/)
    await expect(page.getByRole('dialog').getByText('1.356 ETH').first()).toBeVisible()
  })

  test('edição esgotada no carrinho aberto atualiza o resumo', async ({ app, page }) => {
    await app.addToCart('golden-beat-207')
    await app.addToCart('emerald-ape-042')
    await app.mock.updateNft({ fromCart: true, soldOut: true })
    await expect(page.getByText(/Golden Beat #207 \(edição 1\/50\) esgotou/).first()).toBeVisible()
    await expect(page.getByText('Esta edição esgotou e não será cobrada.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Conectar e finalizar' })).toBeDisabled()
    await page.getByRole('button', { name: 'Aceitar alterações' }).click()
    await expect(page.getByRole('link', { name: 'Golden Beat #207' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Conectar e finalizar' })).toBeEnabled()
  })

  test('eventos duplicados ou antigos não regridem o estado', async ({ app, page }) => {
    test.skip(app.isMobile, 'Lógica de eventos independente de viewport')
    await app.goto('/nft/golden-beat-207')
    await expect(page.getByText('0.99 ETH').first()).toBeVisible()
    await app.mock.updateNft({ slug: 'golden-beat-207', price: '1.25' }) // v2
    await expect(page.getByText('1.25 ETH').first()).toBeVisible()
    await app.mock.updateNft({ slug: 'golden-beat-207', price: '1.50' }) // v3
    await expect(page.getByText('1.50 ETH').first()).toBeVisible()
    // Reenvia o evento antigo (v2) e o último (v3 duplicado)
    await app.mock.replayEvent({ mode: 'stale' })
    await app.mock.replayEvent({ mode: 'last' })
    await page.waitForTimeout(500)
    await expect(page.getByText('1.50 ETH').first()).toBeVisible()
    await expect(page.getByText('1.25 ETH')).toHaveCount(0)
  })

  test('desconexão com pedido pendente: reconecta e recupera sem nova compra', async ({ app, page }) => {
    test.setTimeout(90_000)
    await app.loginAs('nova')
    await app.mock.setScenario(['instant', 'slow-settlement'])
    await app.addToCart('golden-beat-207')
    const review = await goToReview(app, page)
    await review.getByRole('button', { name: /Confirmar e pagar/ }).click()
    await expect(page.getByText('Aguardando confirmação da rede…')).toBeVisible()

    // Queda do tempo real e recarga da página com o pedido pendente
    await app.mock.disconnectSocket(3000)
    await expect(page.getByText('Reconectando às atualizações em tempo real…')).toBeVisible()
    await page.reload()
    await page.waitForSelector('html[data-mocks=ready]')
    await expect(page.getByText('Aguardando confirmação da rede…')).toBeVisible()

    // Liquidação acontece (20 s no cenário) e a UI chega ao recibo
    await expect(page).toHaveURL(/\/pedidos\/ord_/, { timeout: 40_000 })
    const { items } = await app.mock.orders()
    expect(items).toHaveLength(1)
    expect(items[0]?.status).toBe('confirmed')
  })
})
