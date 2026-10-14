import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export function NotFoundPage({ title = 'Página não encontrada', description }: { title?: string; description?: string }) {
  return (
    <section className="container-page flex flex-col items-center gap-4 py-24 text-center" aria-labelledby="not-found-title">
      <p className="text-sm font-bold tracking-widest text-copper-bright">404</p>
      <h1 id="not-found-title" className="text-2xl font-bold md:text-3xl">
        {title}
      </h1>
      <p className="max-w-md text-sm text-sand">
        {description ?? 'O endereço que você acessou não existe ou foi removido.'}
      </p>
      <Button asChild>
        <Link to="/">Voltar para o início</Link>
      </Button>
    </section>
  )
}
