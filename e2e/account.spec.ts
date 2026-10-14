import { expect, test } from './fixtures'

// PNG 1×1 válido (avatar de teste)
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HgAGgwJ/lK3Q6wAAAABJRU5ErkJggg==',
  'base64',
)

test.describe('Perfil e carteiras', () => {
  test('edição de perfil com erros de validação e da API, persistida após refresh', async ({ app, page }) => {
    await app.loginAs('nova', '/perfil')
    const name = page.getByRole('textbox', { name: /Nome de exibição/ })
    await name.fill('')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(name).toHaveAttribute('aria-invalid', 'true')
    await expect(name).toBeFocused()

    await name.fill('Nova Sato Collector')
    await page.getByRole('textbox', { name: /Nome de usuário/ }).fill('teo.mint')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByText('Este nome de usuário já está em uso.')).toBeVisible()

    await page.getByRole('textbox', { name: /Nome de usuário/ }).fill('nova.sato')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByText('Perfil salvo.')).toBeVisible()
    await page.reload()
    await expect(page.getByRole('textbox', { name: /Nome de usuário/ })).toHaveValue('nova.sato')
    await expect(page.getByRole('textbox', { name: /Nome de exibição/ })).toHaveValue('Nova Sato Collector')
  })

  test('avatar: alterar e remover', async ({ app, page }) => {
    await app.loginAs('nova', '/perfil')
    await page.locator('input[type=file]').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: PNG })
    await expect(page.getByText('Avatar atualizado.')).toBeVisible()
    await expect(page.getByRole('img', { name: 'Seu avatar atual' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('img', { name: 'Seu avatar atual' })).toBeVisible()
    await page.getByRole('button', { name: 'Remover', exact: true }).click()
    await expect(page.getByText('Avatar removido.')).toBeVisible()
    await expect(page.getByRole('img', { name: 'Seu avatar atual' })).toHaveCount(0)

    await page.locator('input[type=file]').setInputFiles({ name: 'doc.txt', mimeType: 'text/plain', buffer: Buffer.from('x') })
    await expect(page.getByRole('alert').filter({ hasText: 'Envie uma imagem PNG, JPG ou WebP.' })).toBeVisible()
  })

  test('alteração de senha com validação e senha atual incorreta', async ({ app, page }) => {
    await app.loginAs('nova', '/perfil')
    await page.getByLabel('Nova senha', { exact: true }).fill('curta')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByText('Informe a senha atual.')).toBeVisible()
    await expect(page.getByText('A senha deve ter pelo menos 8 caracteres')).toBeVisible()

    await page.getByLabel('Senha atual').fill('errada000')
    await page.getByLabel('Nova senha', { exact: true }).fill('NovaSenha2026')
    await page.getByLabel('Confirmar nova senha').fill('NovaSenha2026')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByText('Senha atual incorreta.')).toBeVisible()

    await page.getByLabel('Senha atual').fill('Kurio@2026')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByText('Senha alterada.')).toBeVisible()

    // A nova senha passa a valer no login
    await page.evaluate(() => localStorage.removeItem('kurio:session'))
    await app.goto('/entrar')
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('textbox', { name: /E-mail/ }).fill('colecionador@kurio.dev')
    await dialog.getByRole('textbox', { name: 'Senha (obrigatório)', exact: true }).fill('NovaSenha2026')
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL('/')
  })

  test('carteiras: validação, erro da API e cadastro da secundária', async ({ app, page }) => {
    await app.loginAs('teo', '/perfil/carteiras')
    await page.getByRole('button', { name: 'Editar' }).click()
    const primary = page.getByRole('form', { name: 'Carteira principal' })
    await primary.getByRole('textbox', { name: /Endereço da carteira/ }).fill('0x123')
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(primary.getByText('Informe um endereço 0x com 40 caracteres hexadecimais')).toBeVisible()
    await primary.getByRole('textbox', { name: /Endereço da carteira/ }).fill('0x7C2d9E1f4A6b8C0d3E5f7A9b1C2d4E6f8A0b2C4D')
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText('Carteira principal salva.')).toBeVisible()

    // Secundária copiando a principal: o endereço igual é recusado pela API
    await page.getByRole('checkbox', { name: 'Igual à carteira principal' }).check()
    await page.getByRole('button', { name: 'Adicionar' }).click()
    const secondary = page.getByRole('form', { name: 'Carteira secundária' })
    await secondary.getByRole('textbox', { name: /Apelido da carteira/ }).fill('Cofre')
    await secondary.getByRole('textbox', { name: /Endereço da carteira/ }).fill('0x7C2d9E1f4A6b8C0d3E5f7A9b1C2d4E6f8A0b2C4D')
    await secondary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(secondary.getByText('Este endereço já está na carteira principal.')).toBeVisible()

    await secondary.getByRole('textbox', { name: /Endereço da carteira/ }).fill('0x1111111111111111111111111111111111111111')
    await secondary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText('Carteira secundária salva.')).toBeVisible()
    await page.reload()
    await expect(page.getByRole('form', { name: 'Carteira secundária' }).getByRole('textbox', { name: /Apelido da carteira/ })).toHaveValue('Cofre')
  })
})
