import { useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { errorMessage } from '@/api/errors'
import { Button } from '@/components/ui/button'

export function RouteErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  return (
    <section role="alert" className="container-page flex flex-col items-center gap-4 py-24 text-center">
      <h1 className="text-2xl font-bold">Algo deu errado</h1>
      <p className="max-w-md text-sm text-sand">{errorMessage(error)}</p>
      <Button
        onClick={() => {
          reset()
          void router.invalidate()
        }}
      >
        Tentar novamente
      </Button>
    </section>
  )
}
