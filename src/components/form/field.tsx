import { Eye, EyeOff } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const inputClass =
  'h-10 w-full min-w-0 rounded-none border border-line bg-transparent px-3 text-sm text-cream placeholder:text-khaki transition-colors focus-visible:border-copper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 aria-invalid:border-coral disabled:opacity-60'

interface FieldProps extends Omit<React.ComponentProps<'input'>, 'onChange' | 'value' | 'name'> {
  name: string
  label: ReactNode
  value: string
  error?: string
  hint?: ReactNode
  required?: boolean
  onChange: (event: { target: { value: string } }) => void
  /** Esconde visualmente o label (o placeholder fica como pista visual, como no Figma). */
  hideLabel?: boolean
  containerClassName?: string
  adornment?: ReactNode
}

/**
 * Campo com label, dica e erro associados (aria-describedby/aria-invalid).
 * O asterisco segue o Figma; a obrigatoriedade também é anunciada em texto.
 */
export function Field({ name, label, value, error, hint, required, onChange, hideLabel, containerClassName, adornment, className, id, ...props }: FieldProps) {
  const autoId = useId()
  const inputId = id ?? `${autoId}-${name}`
  const describedBy = [error ? `${inputId}-error` : null, hint ? `${inputId}-hint` : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-2', containerClassName)}>
      <label htmlFor={inputId} className={cn('text-[15px] leading-5', hideLabel && 'sr-only')}>
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
      <div className="relative flex">
        {adornment}
        <input
          id={inputId}
          name={name}
          value={value}
          onChange={onChange}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          className={cn(inputClass, className)}
          {...props}
        />
      </div>
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-xs text-khaki">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${inputId}-error`} className="text-xs text-coral">
          {error}
        </p>
      )}
    </div>
  )
}

export function PasswordField(props: Omit<FieldProps, 'type'>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Field {...props} type={visible ? 'text' : 'password'} className={cn('pr-11', props.className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visible}
        className={cn(
          'absolute right-1 grid size-8 place-items-center rounded-sm text-khaki hover:text-copper-bright',
          props.hideLabel ? 'top-1' : 'top-[33px]',
        )}
      >
        {visible ? <EyeOff className="size-[18px]" aria-hidden="true" /> : <Eye className="size-[18px]" aria-hidden="true" />}
      </button>
    </div>
  )
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-sm border border-coral/50 bg-coral/10 px-3 py-2 text-sm text-coral">
      {message}
    </p>
  )
}
