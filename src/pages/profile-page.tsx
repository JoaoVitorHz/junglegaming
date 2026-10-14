import { ImagePlus } from 'lucide-react'
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { toast } from 'sonner'
import { passwordRule, profileUpdateSchema, type User } from '@/api/contracts'
import { errorMessage } from '@/api/errors'
import { ProfileShell } from '@/components/account/profile-shell'
import { Field, FormError, PasswordField } from '@/components/form/field'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useForm } from '@/hooks/use-form'
import { useChangePassword, useProfile, useRemoveAvatar, useUpdateAvatar, useUpdateProfile } from '@/queries/account'
import { z } from 'zod'

const MAX_AVATAR_BYTES = 300 * 1024

/** Reduz a imagem para 256 px (JPEG) antes do envio — mantém o payload pequeno. */
async function toAvatarDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const scale = Math.max(size / bitmap.width, size / bitmap.height)
  const w = bitmap.width * scale
  const h = bitmap.height * scale
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h)
  return canvas.toDataURL('image/jpeg', 0.85)
}

function AvatarField({ user }: { user: User }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const update = useUpdateAvatar()
  const remove = useRemoveAvatar()
  const [error, setError] = useState<string | null>(null)

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Envie uma imagem PNG, JPG ou WebP.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('A imagem deve ter no máximo 5 MB.')
      return
    }
    setError(null)
    try {
      const dataUrl = await toAvatarDataUrl(file)
      if (dataUrl.length > MAX_AVATAR_BYTES * 1.37) {
        setError('Não foi possível reduzir a imagem. Tente outra.')
        return
      }
      update.mutate(
        { dataUrl },
        {
          onSuccess: () => toast.success('Avatar atualizado.'),
          onError: (e) => setError(errorMessage(e)),
        },
      )
    } catch {
      setError('Não foi possível ler a imagem.')
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span id="avatar-label" className="text-[15px]">
        Avatar
      </span>
      <div className="flex items-center gap-6" role="group" aria-labelledby="avatar-label">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="Seu avatar atual" className="size-[50px] rounded-full border border-line-strong object-cover" />
        ) : (
          <span className="grid size-[50px] place-items-center rounded-full border border-line-strong bg-surface-raised text-copper-bright">
            <ImagePlus className="size-5" aria-hidden="true" />
            <span className="sr-only">Sem avatar</span>
          </span>
        )}
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} onChange={(e) => void onFile(e)} aria-hidden="true" />
        <Button type="button" className="h-10 px-6 text-sm font-bold" onClick={() => inputRef.current?.click()} disabled={update.isPending}>
          {update.isPending ? 'Enviando…' : 'Alterar'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="text-sm"
          disabled={!user.avatarUrl || remove.isPending}
          onClick={() =>
            remove.mutate(undefined, {
              onSuccess: () => toast.success('Avatar removido.'),
              onError: (e) => setError(errorMessage(e)),
            })
          }
        >
          Remover
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-coral">
          {error}
        </p>
      )}
    </div>
  )
}

const passwordFormSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string(),
  confirmPassword: z.string(),
})

function ProfileForm({ user }: { user: User }) {
  const updateProfile = useUpdateProfile()
  const changePassword = useChangePassword()
  const profile = useForm({
    schema: profileUpdateSchema,
    initialValues: {
      displayName: user.displayName,
      username: user.username,
      email: user.email,
      ensName: user.ensName,
      walletNickname: user.walletNickname,
    },
  })
  const password = useForm({
    schema: passwordFormSchema,
    initialValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    refine: (v) => {
      if (!v.currentPassword && !v.newPassword && !v.confirmPassword) return {}
      const errors: Record<string, string> = {}
      if (!v.currentPassword) errors.currentPassword = 'Informe a senha atual.'
      const rule = passwordRule.safeParse(v.newPassword)
      if (!rule.success) errors.newPassword = rule.error.issues[0]?.message ?? 'Senha inválida.'
      if (v.confirmPassword !== v.newPassword) errors.confirmPassword = 'As senhas não coincidem.'
      return errors
    },
  })
  const { formRef } = profile
  const { formRef: passwordRef } = password
  const wantsPasswordChange = Object.values(password.values).some(Boolean)
  const saving = updateProfile.isPending || changePassword.isPending

  // Um único "Salvar" (como no Figma): valida tudo antes; salva o perfil e, se preenchida, a nova senha.
  function submit(event: FormEvent) {
    event.preventDefault()
    let passwordData: { currentPassword: string; newPassword: string } | null = null
    if (wantsPasswordChange) {
      password.handleSubmit((d) => (passwordData = d))(event)
      if (!passwordData) return
    }
    profile.handleSubmit((data) =>
      updateProfile.mutate(data, {
        onSuccess: () => {
          toast.success('Perfil salvo.')
          if (!passwordData) return
          changePassword.mutate(passwordData, {
            onSuccess: () => {
              password.reset()
              toast.success('Senha alterada.')
            },
            onError: (e) => password.applyServerError(e),
          })
        },
        onError: (e) => profile.applyServerError(e),
      }),
    )(event)
  }

  return (
    <form
      ref={(el) => {
        formRef.current = el
        passwordRef.current = el
      }}
      onSubmit={submit} noValidate className="flex flex-col gap-6">
      <h1 className="text-base font-bold">Perfil do colecionador</h1>
      <FormError message={profile.errors._form} />
      <div className="grid gap-x-7 gap-y-6 lg:grid-cols-2">
        <Field {...profile.field('displayName')} label="Nome de exibição" required autoComplete="name" />
        <Field {...profile.field('username')} label="Nome de usuário" required autoComplete="username" />
        <Field {...profile.field('email')} label="E-mail" required type="email" autoComplete="email" />
        <Field
          {...profile.field('ensName')}
          label="Nome ENS"
          required
          autoComplete="off"
          adornment={<span className="mr-2.5 grid h-10 shrink-0 place-items-center border border-line px-3 text-sm">.eth</span>}
        />
        <Field {...profile.field('walletNickname')} label="Apelido da carteira" required />
        <AvatarField user={user} />
      </div>

      <fieldset className="flex max-w-[417px] flex-col gap-5">
        <legend className="mb-5 text-base font-bold">Alterar senha</legend>
        <FormError message={password.errors._form} />
        <PasswordField {...password.field('currentPassword')} label="Senha atual" autoComplete="current-password" />
        <PasswordField {...password.field('newPassword')} label="Nova senha" autoComplete="new-password" hint="Mínimo de 8 caracteres, com letras e números." />
        <PasswordField {...password.field('confirmPassword')} label="Confirmar nova senha" autoComplete="new-password" />
      </fieldset>

      <Button type="submit" className="h-10 w-[131px] text-sm font-bold" disabled={saving}>
        {saving ? 'Salvando…' : 'Salvar'}
      </Button>
    </form>
  )
}

export function ProfilePage() {
  useDocumentTitle('Meu perfil')
  const profile = useProfile()
  return (
    <ProfileShell>
      {profile.isPending ? (
        <div className="grid gap-6 lg:grid-cols-2" aria-busy="true" aria-label="Carregando perfil">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      ) : profile.isError ? (
        <Alert variant="destructive" className="border-coral/40 bg-surface">
          <AlertTitle>Não foi possível carregar o perfil</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2">
            <span>{errorMessage(profile.error)}</span>
            <Button size="sm" onClick={() => void profile.refetch()}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <ProfileForm key={profile.data.id} user={profile.data} />
      )}
    </ProfileShell>
  )
}
