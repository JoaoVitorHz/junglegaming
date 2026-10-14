import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { loginRequestSchema, registerRequestSchema } from '@/api/contracts'
import { sessionStore } from '@/auth/session-store'
import { useLogin, useRegister } from '@/auth/use-auth'
import { useSession } from '@/auth/use-session'
import { Field, FormError, PasswordField } from '@/components/form/field'
import { FacebookColorIcon, GoogleIcon } from '@/components/icons/brand-icons'
import { ComingSoon } from '@/components/layout/coming-soon'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Hero } from '@/features/catalog/hero'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useForm } from '@/hooks/use-form'
import { cn } from '@/lib/utils'
import { useFeatured } from '@/queries/nfts'
import type { AuthSearch } from '@/routes/search'

type Mode = 'login' | 'register'

/** Destino pós-login: só caminhos internos; volta ao fluxo que exigiu autenticação. */
function safeRedirect(redirect: string | undefined) {
  return redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/'
}

function SocialButtons() {
  const buttonClass = 'flex h-10 w-full items-center justify-center gap-2 rounded-none border border-line text-[13px] font-medium text-sand'
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-[13px] text-cream md:-mx-20">
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
        Ou continue com
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
      </div>
      <ComingSoon className={buttonClass}>
        <GoogleIcon className="size-5" /> Continuar com Google
      </ComingSoon>
      <ComingSoon className={buttonClass}>
        <FacebookColorIcon className="size-5" /> Continuar com Facebook
      </ComingSoon>
    </div>
  )
}

function ReasonNotice({ reason }: { reason: AuthSearch['reason'] }) {
  if (!reason) return null
  return (
    <p role="status" className="rounded-sm border border-copper/40 bg-copper/10 px-3 py-2 text-xs text-sand">
      {reason === 'expired' ? 'Sua sessão expirou. Entre novamente para continuar de onde parou.' : 'Entre na sua conta para continuar.'}
    </p>
  )
}

const inputShape = 'rounded-lg md:rounded-none'

function LoginForm() {
  const login = useLogin()
  const form = useForm({ schema: loginRequestSchema, initialValues: { email: '', password: '' } })
  const { formRef } = form

  const submit = form.handleSubmit((data) =>
    login.mutate(data, {
      onSuccess: (session) => toast.success(`Bem-vindo de volta, ${session.user.displayName}!`),
      onError: (error) => form.applyServerError(error),
    }),
  )

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-3" aria-label="Entrar">
      <FormError message={form.errors._form} />
      <Field {...form.field('email')} label="E-mail" hideLabel type="email" autoComplete="email" placeholder="contato@email.com" required className={inputShape} />
      <PasswordField {...form.field('password')} label="Senha" hideLabel autoComplete="current-password" placeholder="Senha" required className={inputShape} />
      <div className="flex justify-end">
        <ComingSoon className="text-sm text-copper-bright">Esqueceu a senha?</ComingSoon>
      </div>
      <Button type="submit" className="mt-3 h-[60px] rounded-lg text-base font-bold md:mt-4 md:h-[45px] md:rounded-none" disabled={login.isPending}>
        {login.isPending ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  )
}

function RegisterForm() {
  const register = useRegister()
  const form = useForm({
    schema: registerRequestSchema.extend({ confirmPassword: registerRequestSchema.shape.password }),
    initialValues: { username: '', email: '', password: '', confirmPassword: '' },
    refine: (v) => (v.confirmPassword && v.confirmPassword !== v.password ? { confirmPassword: 'As senhas não coincidem.' } : {}),
  })
  const { formRef } = form

  const submit = form.handleSubmit(({ username, email, password }) =>
    register.mutate(
      { username, email, password },
      {
        onSuccess: (session) => toast.success(`Conta criada. Bem-vindo, ${session.user.displayName}!`),
        onError: (error) => form.applyServerError(error),
      },
    ),
  )

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-3" aria-label="Criar conta">
      <FormError message={form.errors._form} />
      <Field {...form.field('username')} label="Nome de usuário" hideLabel autoComplete="username" placeholder="Nome de usuário" required className={inputShape} />
      <Field {...form.field('email')} label="E-mail" hideLabel type="email" autoComplete="email" placeholder="Digite seu e-mail" required className={inputShape} />
      <PasswordField
        {...form.field('password')}
        label="Senha"
        hideLabel
        autoComplete="new-password"
        placeholder="Senha"
        required
        hint="Mínimo de 8 caracteres, com letras e números."
        className={inputShape}
      />
      <PasswordField {...form.field('confirmPassword')} label="Confirmar senha" hideLabel autoComplete="new-password" placeholder="Confirmar senha" required className={inputShape} />
      <Button type="submit" className="mt-5 h-[60px] rounded-lg text-base font-bold md:h-[45px] md:rounded-none" disabled={register.isPending}>
        {register.isPending ? (
          'Criando conta…'
        ) : (
          <>
            <span className="md:hidden">Criar perfil</span>
            <span className="max-md:hidden">Criar conta</span>
          </>
        )}
      </Button>
    </form>
  )
}

function AuthScreen({ mode, search }: { mode: Mode; search: AuthSearch }) {
  const navigate = useNavigate()
  const session = useSession()
  const featured = useFeatured()
  useDocumentTitle(mode === 'login' ? 'Entrar' : 'Criar conta')

  // Autenticou (ou já estava autenticado ao chegar aqui): segue para o destino.
  useEffect(() => {
    if (session.status === 'authenticated') void navigate({ href: safeRedirect(search.redirect), replace: true })
  }, [session.status, navigate, search.redirect])

  function close() {
    if (session.status === 'expired') sessionStore.dismissExpired()
    void navigate({ to: '/' })
  }

  const tabClass = 'text-xl leading-6 hover:text-copper-bright aria-[current=page]:text-copper-bright'

  return (
    <>
      {/* Desktop: a Início ao fundo, como no Figma (o diálogo fica por cima). */}
      <div className="container-page hidden pt-8 md:block" aria-hidden="true" inert>
        <Hero items={featured.data?.hero} isLoading={featured.isPending} />
      </div>
      <Dialog open onOpenChange={(open) => !open && close()}>
        <DialogContent
          aria-describedby="auth-desc"
          className={cn(
            'gap-0 border-0 bg-ink p-0 shadow-none sm:max-w-none',
            'max-md:inset-0 max-md:top-0 max-md:left-0 max-md:h-dvh max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:overflow-y-auto max-md:rounded-none',
            'md:w-[500px] md:max-w-[500px] md:rounded-none md:border-b-[10px] md:border-copper md:bg-surface',
          )}
        >
          <div className="flex flex-col gap-8 px-7 pt-24 pb-12 md:gap-5 md:px-20 md:pt-12 md:pb-20">
            <p className="text-center text-3xl font-bold tracking-[0.1em] md:hidden" aria-hidden="true">
              KURIO
            </p>
            <div className="flex flex-col items-center gap-6 md:gap-8">
              <DialogTitle className="text-center text-xl font-bold md:sr-only">
                {mode === 'login' ? 'Entrar' : <span>Criar perfil de colecionador</span>}
              </DialogTitle>
              <nav aria-label="Entrar ou criar conta" className="flex items-center gap-1 max-md:hidden">
                <Link activeOptions={{ exact: true }} to="/entrar" search={search} replace className={tabClass} aria-current={mode === 'login' ? 'page' : undefined}>
                  Entrar
                </Link>
                <span aria-hidden="true" className="mx-1 h-6 w-px bg-copper" />
                <Link activeOptions={{ exact: true }} to="/cadastro" search={search} replace className={tabClass} aria-current={mode === 'register' ? 'page' : undefined}>
                  Criar conta
                </Link>
              </nav>
              <DialogDescription id="auth-desc" className="max-w-[340px] text-center text-[13px] leading-4 text-cream max-md:sr-only">
                {mode === 'login'
                  ? 'Entre para gerenciar sua carteira, coleção e perfil de criador.'
                  : 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.'}
              </DialogDescription>
            </div>
            <ReasonNotice reason={search.reason} />
            {mode === 'login' ? <LoginForm /> : <RegisterForm />}
            <SocialButtons />
            <p className="text-center text-sm text-sand md:hidden">
              {mode === 'login' ? (
                <>
                  Novo na Kurio?{' '}
                  <Link activeOptions={{ exact: true }} to="/cadastro" search={search} replace className="underline-offset-2 hover:underline">
                    Crie uma conta
                  </Link>
                </>
              ) : (
                <>
                  Já tem uma conta?{' '}
                  <Link activeOptions={{ exact: true }} to="/entrar" search={search} replace className="underline-offset-2 hover:underline">
                    Entre
                  </Link>
                </>
              )}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

const loginRoute = getRouteApi('/entrar')
const registerRoute = getRouteApi('/cadastro')

export function LoginPage() {
  return <AuthScreen mode="login" search={loginRoute.useSearch()} />
}

export function RegisterPage() {
  return <AuthScreen mode="register" search={registerRoute.useSearch()} />
}
