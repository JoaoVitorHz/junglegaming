import { MoreVertical, Wallet as WalletIcon } from 'lucide-react'
import type { Wallet, WalletConnection, WalletProvider } from '@/api/contracts'
import { walletProviders } from '@/api/contracts'
import { WalletsChip } from '@/components/layout/site-footer'
import { networkLabels, providerLabels } from '@/lib/labels'
import { cn } from '@/lib/utils'

interface WalletSelectorProps {
  wallets: Wallet[]
  selectedWalletId: string | null
  onSelectWallet: (wallet: Wallet) => void
  provider: string
  onSelectProvider: (provider: WalletProvider) => void
  providerLocked: boolean
  connection: WalletConnection | null
  onDisconnect: () => void
}

const radioDot =
  'grid size-[18px] shrink-0 place-items-center rounded-full border-2 border-copper after:size-2 after:rounded-full after:bg-copper after:opacity-0 peer-checked:after:opacity-100'

function shortAddress(address: string) {
  return address.startsWith('0x') ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
}

const providerMark: Record<WalletProvider, string> = { walletconnect: 'W', metamask: 'M', coinbase: 'C' }

/** "Carteira conectada" + "Carteira e rede" (frames de pagamento desktop e mobile). */
export function WalletSelector({
  wallets,
  selectedWalletId,
  onSelectWallet,
  provider,
  onSelectProvider,
  providerLocked,
  connection,
  onDisconnect,
}: WalletSelectorProps) {
  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 flex w-full items-center justify-between text-base font-bold">Carteira conectada</legend>
        {wallets.length === 0 ? (
          <p className="text-sm text-sand">Nenhuma carteira cadastrada. Informe o endereço no formulário ou cadastre em Carteiras.</p>
        ) : (
          wallets.map((wallet) => (
            <label
              key={wallet.id}
              className="flex cursor-pointer items-start gap-4 rounded-xl bg-surface px-4 py-4 has-focus-visible:outline-2 has-focus-visible:outline-ring"
            >
              <input
                type="radio"
                name="wallet"
                className="peer sr-only"
                checked={selectedWalletId === wallet.id}
                onChange={() => onSelectWallet(wallet)}
              />
              <span aria-hidden="true" className={cn(radioDot, 'mt-1')} />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-base font-bold">
                  {wallet.nickname}
                  <span className="sr-only"> ({wallet.role === 'primary' ? 'principal' : 'secundária'})</span>
                </span>
                <span className="truncate text-sm text-sand">{wallet.secondaryAddress || shortAddress(wallet.address)}</span>
                <span className="text-sm text-sand">
                  {wallet.role === 'primary' ? 'Rede principal' : 'Rede'} {networkLabels[wallet.network]} · {providerLabels[wallet.provider]}
                </span>
              </span>
              <MoreVertical className="size-5 text-copper-bright" aria-hidden="true" />
            </label>
          ))
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-3" disabled={providerLocked}>
        <legend className="mb-3 text-base font-bold">Carteira e rede</legend>
        <div className="hidden md:block">
          <WalletsChip />
        </div>
        {walletProviders.map((p) => (
          <label
            key={p}
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-xl border border-transparent bg-surface px-4 py-3 has-focus-visible:outline-2 has-focus-visible:outline-ring md:rounded-none md:border-line md:bg-transparent',
              provider === p && 'md:border-cream',
              providerLocked && 'cursor-default',
            )}
          >
            <input type="radio" name="provider" className="peer sr-only" checked={provider === p} onChange={() => onSelectProvider(p)} />
            <span aria-hidden="true" className="grid size-10 place-items-center rounded-full border border-line-strong bg-surface-raised text-sm font-bold text-copper-bright md:hidden">
              {providerMark[p]}
            </span>
            <span aria-hidden="true" className={cn(radioDot, 'max-md:order-last')} />
            <span className="flex-1 text-sm">{providerLabels[p]}</span>
          </label>
        ))}
        {providerLocked && <p className="text-xs text-khaki">O tipo de carteira segue a carteira cadastrada escolhida.</p>}
      </fieldset>

      <div role="status" aria-live="polite" className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2 text-xs text-sand">
        {connection?.status === 'connected' ? (
          <>
            <span className="flex items-center gap-2">
              <WalletIcon className="size-4 text-mint" aria-hidden="true" />
              Conectada: {providerLabels[connection.provider]} · {networkLabels[connection.network]}
            </span>
            <button type="button" className="text-copper-bright underline-offset-2 hover:underline" onClick={onDisconnect}>
              Desconectar
            </button>
          </>
        ) : (
          <span className="flex items-center gap-2">
            <WalletIcon className="size-4 text-khaki" aria-hidden="true" />
            {connection?.status === 'disconnected'
              ? 'Carteira desconectada. Ela será reconectada ao confirmar a compra.'
              : 'A carteira será conectada ao confirmar a compra.'}
          </span>
        )}
      </div>
    </div>
  )
}
