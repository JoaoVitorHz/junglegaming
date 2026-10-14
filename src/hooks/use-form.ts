import { useCallback, useRef, useState, type FormEvent } from 'react'
import type { z } from 'zod'
import { toApiError } from '@/api/errors'

type Errors<T> = Partial<Record<keyof T | '_form', string>>

/** Valores do formulário: sempre strings (o que o usuário digitou), validadas pelo schema no envio. */
export type FormValues<S extends z.ZodType> = { [K in keyof z.input<S>]-?: string }

interface UseFormOptions<S extends z.ZodType> {
  schema: S
  initialValues: FormValues<S>
  /** Validação extra que depende de mais de um campo (ex.: confirmação de senha). */
  refine?: (values: FormValues<S>) => Errors<FormValues<S>>
}

/**
 * Formulário controlado validado com zod.
 * - valida no blur (após o primeiro toque) e no envio;
 * - mapeia `fieldErrors` da API para os campos;
 * - leva o foco ao primeiro campo inválido.
 */
export function useForm<S extends z.ZodType>({ schema, initialValues, refine }: UseFormOptions<S>) {
  type V = FormValues<S>
  const [values, setValues] = useState<V>(initialValues)
  const [errors, setErrors] = useState<Errors<V>>({})
  const [touched, setTouched] = useState<Partial<Record<keyof V, boolean>>>({})
  const formRef = useRef<HTMLFormElement>(null)

  const validate = useCallback(
    (next: V): Errors<V> => {
      const result = schema.safeParse(next)
      const found: Errors<V> = {}
      if (!result.success) {
        for (const issue of result.error.issues) {
          const key = String(issue.path[0] ?? '_form') as keyof V
          found[key] ??= issue.message
        }
      }
      return { ...found, ...refine?.(next) }
    },
    [schema, refine],
  )

  const focusFirstError = useCallback((errs: Errors<V>) => {
    const first = Object.keys(errs).find((k) => k !== '_form')
    if (!first) return
    const el = formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)
    el?.focus()
  }, [])

  function setValue(name: keyof V, value: string) {
    setValues((prev) => {
      const next = { ...prev, [name]: value }
      if (touched[name] || errors[name]) {
        const fieldError = validate(next)[name]
        setErrors((e) => ({ ...e, [name]: fieldError, _form: undefined }))
      }
      return next
    })
  }

  function onBlur(name: keyof V) {
    setTouched((t) => ({ ...t, [name]: true }))
    setErrors((e) => ({ ...e, [name]: validate(values)[name] }))
  }

  function handleSubmit(onValid: (data: z.output<S>) => void) {
    return (event: FormEvent) => {
      event.preventDefault()
      const errs = validate(values)
      const fieldErrs = Object.entries(errs).filter(([, v]) => v)
      if (fieldErrs.length > 0) {
        setErrors(errs)
        setTouched(Object.fromEntries(Object.keys(values).map((k) => [k, true])) as typeof touched)
        focusFirstError(errs)
        return
      }
      onValid(schema.parse(values) as z.output<S>)
    }
  }

  /** Aplica um erro da API: campos conhecidos recebem a mensagem; o resto vira erro do formulário. */
  function applyServerError(error: unknown) {
    const apiError = toApiError(error)
    const fieldErrors: Errors<V> = {}
    for (const [key, message] of Object.entries(apiError.fieldErrors)) {
      if (key in values) fieldErrors[key as keyof V] = message
    }
    const hasFieldErrors = Object.keys(fieldErrors).length > 0
    setErrors({ ...fieldErrors, _form: hasFieldErrors ? undefined : apiError.message })
    focusFirstError(fieldErrors)
    return apiError
  }

  function field(name: keyof V & string) {
    return {
      name,
      value: (values[name] as string | undefined) ?? '',
      error: errors[name],
      onChange: (event: { target: { value: string } }) => setValue(name, event.target.value),
      onBlur: (event?: { relatedTarget?: EventTarget | null }) => {
        // Indo para o botão de envio: o submit valida tudo. Validar aqui
        // renderizaria o erro antes do clique e deslocaria o botão.
        const next = event?.relatedTarget as HTMLElement | null | undefined
        if (next?.getAttribute?.('type') === 'submit') return
        onBlur(name)
      },
    }
  }

  return {
    values,
    errors,
    formRef,
    field,
    setValue,
    setValues,
    setErrors,
    handleSubmit,
    applyServerError,
    reset: (next?: V) => {
      setValues(next ?? initialValues)
      setErrors({})
      setTouched({})
    },
  }
}
