import { useId } from 'react'
import { Field, inputClass } from '@/components/form/field'
import { networkOptions, providerOptions } from '@/lib/labels'
import { cn } from '@/lib/utils'

export interface CollectorValues {
  displayName: string
  username: string
  network: string
  profileName: string
  walletAddress: string
  secondaryAddress: string
  provider: string
  referralCode: string
  email: string
  ensName: string
  note: string
}

type FieldBinding = {
  name: string
  value: string
  error?: string
  onChange: (event: { target: { value: string } }) => void
  onBlur: () => void
}

interface SelectFieldProps extends FieldBinding {
  label: string
  options: { value: string; label: string }[]
  placeholder: string
  required?: boolean
  disabled?: boolean
}

export function SelectField({ name, value, error, onChange, onBlur, label, options, placeholder, required, disabled }: SelectFieldProps) {
  const id = useId()
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[15px] leading-5">
        {label}
        {required && (
          <>
            <span aria-hidden="true" className="ml-0.5 text-coral">
              *
            </span>
            <span className="sr-only"> (obrigatório)</span>
          </>
        )}
      </label>
      <select
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-required={required || undefined}
        className={cn(inputClass, 'appearance-none bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20viewBox%3D%270%200%2024%2024%27%20fill%3D%27none%27%20stroke%3D%27%23cfb28c%27%20stroke-width%3D%272%27%3E%3Cpath%20d%3D%27m6%209%206%206%206-6%27/%3E%3C/svg%3E")] bg-[length:18px] bg-[right_10px_center] bg-no-repeat pr-9', !value && 'text-khaki')}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-surface text-cream">
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${id}-error`} className="text-xs text-coral">
          {error}
        </p>
      )}
    </div>
  )
}


interface CollectorFormProps {
  field: (name: keyof CollectorValues) => FieldBinding
  /** Campos da carteira vêm da carteira cadastrada escolhida (somente leitura). */
  walletLocked: boolean
  useOtherWallet: boolean
  onToggleOtherWallet: (value: boolean) => void
}

/** Campos do frame "Perfil do colecionador" do pagamento. */
export function CollectorForm({ field, walletLocked, useOtherWallet, onToggleOtherWallet }: CollectorFormProps) {
  const noteId = useId()
  const note = field('note')
  return (
    <fieldset className="flex flex-col gap-5">
      <legend className="mb-4 text-lg font-bold">Perfil do colecionador</legend>
      <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
        <Field {...field('displayName')} label="Nome de exibição" required autoComplete="name" />
        <Field {...field('username')} label="Nome de usuário" required autoComplete="username" />
        <SelectField {...field('network')} label="Rede" required placeholder="Selecione uma rede" options={networkOptions} disabled={walletLocked} />
        <Field {...field('profileName')} label="Nome do perfil" required />
        <Field
          {...field('walletAddress')}
          label="Endereço da carteira"
          required
          placeholder="Endereço 0x da carteira"
          readOnly={walletLocked}
          spellCheck={false}
          autoComplete="off"
          className="font-mono text-xs"
        />
        <Field
          {...field('secondaryAddress')}
          label="ENS ou carteira secundária (opcional)"
          placeholder="ENS ou carteira secundária (opcional)"
          readOnly={walletLocked}
          autoComplete="off"
        />
        <SelectField {...field('provider')} label="Tipo de carteira" required placeholder="Selecione uma carteira" options={providerOptions} disabled={walletLocked} />
        <Field {...field('referralCode')} label="Código de indicação" required autoComplete="off" />
        <Field {...field('email')} label="E-mail" required type="email" autoComplete="email" />
        <Field
          {...field('ensName')}
          label="Nome ENS"
          required
          autoComplete="off"
          adornment={<span className="grid h-10 shrink-0 place-items-center border border-r-0 border-line px-3 text-sm">.eth</span>}
          hint="Seu nome ENS sem o sufixo .eth"
        />
      </div>

      <label className="flex w-fit cursor-pointer items-center gap-2 text-[15px]">
        <input
          type="checkbox"
          checked={useOtherWallet}
          onChange={(e) => onToggleOtherWallet(e.target.checked)}
          className="size-[18px] appearance-none rounded-full border-2 border-copper checked:border-[5px] checked:bg-ink focus-visible:outline-2 focus-visible:outline-ring"
        />
        Usar outra carteira?
      </label>

      <div className="flex max-w-[350px] flex-col gap-2">
        <label htmlFor={noteId} className="text-[15px]">
          Observação do colecionador (opcional)
        </label>
        <textarea
          id={noteId}
          name="note"
          value={note.value}
          onChange={note.onChange}
          onBlur={note.onBlur}
          rows={6}
          maxLength={280}
          aria-invalid={note.error ? true : undefined}
          aria-describedby={`${noteId}-count`}
          className={cn(inputClass, 'h-[150px] resize-none py-2')}
        />
        <p id={`${noteId}-count`} className="text-right text-xs text-khaki">
          {note.value.length}/280
        </p>
      </div>
    </fieldset>
  )
}
