import { expect, test, USERS } from './fixtures'

test.describe('Conta e sessão', () => {
  test('cadastro com validação, conflito e sucesso', async ({ app, page }) => {
    await app.goto('/cadastro')
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: /Criar (perfil|conta)/ }).click()
    // Validação local: foco no primeiro campo inválido, erro associado ao campo
    const username = dialog.getByRole('textbox', { name: /Nome de usuário/ })
    await expect(username).toBeFocused()
    await expect(username).toHaveAttribute('aria-invalid', 'true')
    await expect(username).toHaveAccessibleDescription(/pelo menos 3 caracteres/)

    // Conflito retornado pela API
    await username.fill('nova')
    await dialog.getByRole('textbox', { name: /E-mail/ }).fill('colecionador@kurio.dev')
    await dialog.getByRole('textbox', { name: 'Senha (obrigatório)', exact: true }).fill('abc12345')
    await dialog.getByRole('textbox', { name: 'Confirmar senha (obrigatório)', exact: true }).fill('abc12345')
    await dialog.getByRole('button', { name: /Criar (perfil|conta)/ }).click()
    await expect(dialog.getByText('Este nome de usuário já está em uso.')).toBeVisible()
    await expect(dialog.getByText('Este e-mail já está cadastrado.')).toBeVisible()

    // Senhas diferentes
    await username.fill('novo.colecionador')
    await dialog.getByRole('textbox', { name: /E-mail/ }).fill('novo@kurio.dev')
    await dialog.getByRole('textbox', { name: 'Confirmar senha (obrigatório)', exact: true }).fill('abc12399')
    await dialog.getByRole('button', { name: /Criar (perfil|conta)/ }).click()
    await expect(dialog.getByText('As senhas não coincidem.')).toBeVisible()

    await dialog.getByRole('textbox', { name: 'Confirmar senha (obrigatório)', exact: true }).fill('abc12345')
    await dialog.getByRole('button', { name: /Criar (perfil|conta)/ }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByText(/Conta criada/)).toBeVisible()
  })

  test('login inválido, login válido com retorno ao fluxo e logout', async ({ app, page }) => {
    await app.goto('/perfil/carteiras')
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fperfil%2Fcarteiras/)
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Entre na sua conta para continuar.')).toBeVisible()
    await dialog.getByRole('textbox', { name: /E-mail/ }).fill(USERS.nova.email)
    await dialog.getByRole('textbox', { name: 'Senha (obrigatório)', exact: true }).fill('senhaerrada1')
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(dialog.getByRole('alert')).toHaveText('E-mail ou senha incorretos.')

    await dialog.getByRole('textbox', { name: 'Senha (obrigatório)', exact: true }).fill(USERS.nova.password)
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL('/perfil/carteiras')

    // Sessão recuperada após refresh
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Carteira principal' })).toBeVisible()

    await page.getByRole('navigation', { name: 'Minha conta' }).getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL('/')
    await page.goto('/perfil')
    await expect(page).toHaveURL(/\/entrar/)
  })

  test('sessão expirada durante a navegação preserva o destino', async ({ app, page }) => {
    await app.loginAs('nova', '/perfil')
    await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
    await app.mock.expireSession()
    await page.getByRole('link', { name: 'Carteiras' }).first().click()
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fperfil%2Fcarteiras&reason=expired/)
    await expect(page.getByText('Sua sessão expirou.', { exact: false })).toBeVisible()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('textbox', { name: /E-mail/ }).fill(USERS.nova.email)
    await dialog.getByRole('textbox', { name: 'Senha (obrigatório)', exact: true }).fill(USERS.nova.password)
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL('/perfil/carteiras')
  })

  test('expiração pelo relógio (sessão curta) leva ao login', async ({ app, page }) => {
    test.skip(app.isMobile, 'Fluxo de sessão idêntico no mobile')
    await page.clock.install()
    await app.goto('/')
    await app.mock.setScenario(['instant', 'short-session'])
    await app.loginAs('nova', '/perfil')
    await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
    await page.clock.fastForward('01:00')
    await expect(page).toHaveURL(/reason=expired/)
  })

  test('troca de usuário não expõe dados do anterior', async ({ app, page }) => {
    await app.loginAs('nova')
    await app.addToCart('emerald-ape-042')
    await expect(page.getByText('Emerald Ape #042').first()).toBeVisible()
    await app.goto('/perfil/favoritos')
    await expect(page.getByRole('article').getByText('Sage Nomad #009')).toBeVisible()

    // Logout e login com outro usuário
    await page.evaluate(() => localStorage.removeItem('kurio:session'))
    await app.loginAs('teo', '/perfil/favoritos')
    await expect(page.getByRole('article').getByText('Golden Beat #207')).toBeVisible()
    await expect(page.getByText('Sage Nomad #009')).toHaveCount(0)
    await app.goto('/carrinho')
    await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
    await expect(page.getByText('Emerald Ape #042')).toHaveCount(0)
  })
})
