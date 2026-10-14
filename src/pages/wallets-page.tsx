import { useState } from 'react'
import { toast } from 'sonner'
import { walletInputSchema, type User, type Wallet, type WalletRole } from '@/api/contracts'
import { errorMessage } from '@/api/errors'
import { ProfileShell } from '@/components/account/profile-shell'
import { Field, FormError } from '@/components/form/field'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SelectField } from '@/features/checkout/collector-form'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useForm } from '@/hooks/use-form'
import { networkOptions, providerOptions } from '@/lib/labels'
import { useProfile, useSaveWallet, useWallets } from '@/queries/account'

type WalletValues = {
  displayName: string
  nickname: string
  network: string
  profileName: string
  address: string
  secondaryAddress: string
  provider: string
  referralCode: string
  email: string
  ensName: string
}

function valuesFrom(wallet: Wallet | undefined, user: User, base?: Wallet): WalletValues {
  const source = wallet ?? base
  return {
    displayName: source?.displayName ?? user.displayName,
    nickname: wallet?.nickname ?? (base ? '' : user.walletNickname),
    network: source?.network ?? '',
    profileName: source?.profileName ?? '',
    // Endereço nunca é copiado: cada carteira precisa do próprio.
    address: wallet?.address ?? '',
    secondaryAddress: wallet?.secondaryAddress ?? '',
    provider: source?.provider ?? '',
    referralCode: source?.referralCode ?? '',
    email: source?.email ?? user.email,
    ensName: source?.ensName ?? user.ensName,
  }
}

function WalletForm({ walletRole: role, initial, onSaved }: { walletRole: WalletRole; initial: WalletValues; onSaved?: () => void }) {
  const save = useSaveWallet()
  const form = useForm({ schema: walletInputSchema, initialValues: initial })
  const { formRef } = form
  const submit = form.handleSubmit((data) =>
    save.mutate(
      { role, body: { ...data, secondaryAddress: data.secondaryAddress || undefined } },
      {
        onSuccess: () => {
          toast.success(role === 'primary' ? 'Carteira principal salva.' : 'Carteira secundária salva.')
          onSaved?.()
        },
        onError: (e) => form.applyServerError(e),
      },
    ),
  )
  const prefix = role === 'primary' ? 'principal' : 'secundária'
  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-6" aria-label={`Carteira ${prefix}`}>
      <FormError message={form.errors._form} />
      <div className="grid gap-x-7 gap-y-6 lg:grid-cols-2">
        <Field {...form.field('displayName')} label="Nome de exibição" required />
        <Field {...form.field('nickname')} label="Apelido da carteira" required />
        <SelectField {...form.field('network')} label="Rede" required placeholder="Selecione uma rede" options={networkOptions} />
        <Field {...form.field('profileName')} label="Nome do perfil" required />
        <Field {...form.field('address')} label="Endereço da carteira" required placeholder="Endereço 0x da carteira" spellCheck={false} autoComplete="off" className="font-mono text-xs" />
        <Field {...form.field('secondaryAddress')} label="ENS ou carteira secundária (opcional)" placeholder="ENS ou carteira secundária (opcional)" autoComplete="off" />
        <SelectField {...form.field('provider')} label="Tipo de carteira" required placeholder="Selecione uma carteira" options={providerOptions} />
        <Field {...form.field('referralCode')} label="Código de indicação" required autoComplete="off" />
        <Field {...form.field('email')} label="E-mail" required type="email" autoComplete="email" />
        <Field
          {...form.field('ensName')}
          label="Nome ENS"
          required
          autoComplete="off"
          adornment={<span className="mr-2.5 grid h-10 shrink-0 place-items-center border border-line px-3 text-sm">.eth</span>}
        />
      </div>
      <Button type="submit" className="h-10 w-fit px-3 text-sm font-bold" disabled={save.isPending}>
        {save.isPending ? 'Salvando…' : 'Salvar carteira'}
      </Button>
    </form>
  )
}

function WalletsContent({ wallets, user }: { wallets: Wallet[]; user: User }) {
  const primary = wallets.find((w) => w.role === 'primary')
  const secondary = wallets.find((w) => w.role === 'secondary')
  const [editingPrimary, setEditingPrimary] = useState(!primary)
  const [addingSecondary, setAddingSecondary] = useState(false)
  const [sameAsPrimary, setSameAsPrimary] = useState(false)
  const showSecondaryForm = !!secondary || addingSecondary

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="primary-title" className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 id="primary-title" className="text-base font-bold">
              Carteira principal
            </h1>
            <p className="text-sm text-sand">Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p>
          </div>
          {primary && !editingPrimary && (
            <Button variant="link" className="h-auto p-0 text-base font-bold text-copper-bright" onClick={() => setEditingPrimary(true)}>
              Editar
            </Button>
          )}
        </div>
        {editingPrimary || !primary ? (
          <WalletForm key={primary?.updatedAt ?? 'new'} walletRole="primary" initial={valuesFrom(primary, user)} onSaved={() => setEditingPrimary(false)} />
        ) : (
          <WalletSummary wallet={primary} />
        )}
      </section>

      <section aria-labelledby="secondary-title" className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="secondary-title" className="text-lg font-bold">
              Carteira secundária
            </h2>
            {!showSecondaryForm && <p className="text-sm text-sand">Você ainda não adicionou uma carteira secundária.</p>}
          </div>
          {primary && !secondary && (
            <div className="flex items-center gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={sameAsPrimary}
                  onChange={(e) => setSameAsPrimary(e.target.checked)}
                  className="size-[18px] appearance-none rounded-full border-2 border-copper checked:border-[5px] focus-visible:outline-2 focus-visible:outline-ring"
                />
                Igual à carteira principal
              </label>
              {!addingSecondary && (
                <Button variant="link" className="h-auto p-0 text-base font-bold text-copper-bright" onClick={() => setAddingSecondary(true)}>
                  Adicionar
                </Button>
              )}
            </div>
          )}
        </div>
        {!primary && <p className="text-sm text-khaki">Cadastre a carteira principal para adicionar uma secundária.</p>}
        {primary && showSecondaryForm && (
          <WalletForm
            key={`${secondary?.updatedAt ?? 'new'}-${sameAsPrimary}`}
            walletRole="secondary"
            initial={valuesFrom(secondary, user, sameAsPrimary ? primary : undefined)}
            onSaved={() => setAddingSecondary(false)}
          />
        )}
        {sameAsPrimary && showSecondaryForm && !secondary && (
          <p className="text-xs text-khaki">Os dados foram copiados da carteira principal. Informe um endereço diferente para a secundária.</p>
        )}
      </section>
    </div>
  )
}

function WalletSummary({ wallet }: { wallet: Wallet }) {
  return (
    <dl className="grid gap-x-7 gap-y-3 rounded-md bg-surface p-5 text-sm sm:grid-cols-2">
      {[
        ['Apelido', wallet.nickname],
        ['Rede', networkOptions.find((n) => n.value === wallet.network)?.label],
        ['Endereço', wallet.address],
        ['Tipo de carteira', providerOptions.find((p) => p.value === wallet.provider)?.label],
        ['Nome ENS', `${wallet.ensName}.eth`],
        ['E-mail', wallet.email],
      ].map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-khaki">{label}</dt>
          <dd className="truncate font-mono">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function WalletsPage() {
  useDocumentTitle('Carteiras')
  const wallets = useWallets()
  const profile = useProfile()
  return (
    <ProfileShell>
      {wallets.isPending || profile.isPending ? (
        <div className="grid gap-6 lg:grid-cols-2" aria-busy="true" aria-label="Carregando carteiras">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      ) : wallets.isError || profile.isError ? (
        <Alert variant="destructive" className="border-coral/40 bg-surface">
          <AlertTitle>Não foi possível carregar as carteiras</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2">
            <span>{errorMessage(wallets.error ?? profile.error)}</span>
            <Button
              size="sm"
              onClick={() => {
                void wallets.refetch()
                void profile.refetch()
              }}
            >
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <WalletsContent wallets={wallets.data} user={profile.data} />
      )}
    </ProfileShell>
  )
}
