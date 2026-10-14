import { Link } from '@tanstack/react-router'
import { useId, useState, type FormEvent } from 'react'
import { z } from 'zod'
import type { Category } from '@/api/contracts'
import { FacebookIcon, InstagramIcon, LinkedinIcon, TwitterIcon, YoutubeIcon } from '@/components/icons/brand-icons'
import { Button } from '@/components/ui/button'
import { ComingSoon } from './coming-soon'

const features = [
  { mark: 'W', title: 'Segurança da carteira', text: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { mark: 'C', title: 'Criadores em destaque', text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  { mark: 'D', title: 'Alertas de lançamentos', text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.' },
]

const collectionLinks: { label: string; category: Category }[] = [
  { label: 'Arte digital', category: 'arte-digital' },
  { label: 'Fotografia', category: 'fotografia' },
  { label: 'Música', category: 'musica' },
  { label: 'Arte 3D', category: 'arte-3d' },
  { label: 'Utilidade', category: 'utilidade' },
]

const socials = [
  { label: 'Facebook', href: 'https://www.facebook.com/', Icon: FacebookIcon },
  { label: 'Instagram', href: 'https://www.instagram.com/', Icon: InstagramIcon },
  { label: 'X (Twitter)', href: 'https://x.com/', Icon: TwitterIcon },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/', Icon: LinkedinIcon },
  { label: 'YouTube', href: 'https://www.youtube.com/', Icon: YoutubeIcon },
]

const linkClass = 'text-sm leading-[30px] text-cream hover:text-copper-bright'

function Newsletter() {
  const id = useId()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const result = z.email().safeParse(email.trim())
    if (!result.success) {
      setNotice(null)
      setError('Informe um e-mail válido.')
      return
    }
    setError(null)
    // Não há endpoint de newsletter no escopo: não simulamos uma inscrição.
    setNotice('A newsletter ainda não está disponível nesta demonstração. Nenhum e-mail foi cadastrado.')
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="text-lg leading-4 font-bold">
        Antecipe-se ao próximo lançamento
      </h2>
      <div>
        <div className="flex h-10 overflow-hidden rounded-md bg-band">
          <label htmlFor={`${id}-email`} className="sr-only">
            Seu e-mail
          </label>
          <input
            id={`${id}-email`}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="digite seu e-mail..."
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : notice ? `${id}-notice` : undefined}
            className="min-w-0 flex-1 bg-transparent px-3 text-sm text-cream placeholder:text-khaki focus-visible:outline-offset-[-2px]"
          />
          <Button type="submit" className="h-10 rounded-none px-4 text-lg font-bold">
            Enviar
          </Button>
        </div>
        {error && (
          <p id={`${id}-error`} className="mt-2 text-xs text-coral">
            {error}
          </p>
        )}
        {notice && (
          <p id={`${id}-notice`} role="status" className="mt-2 text-xs text-sand">
            {notice}
          </p>
        )}
      </div>
      <p className="text-[13px] leading-[22px] text-sand">
        Receba lançamentos selecionados, histórias de criadores e novidades do mercado.
      </p>
    </form>
  )
}

export function WalletsChip({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-md border border-line-strong bg-band px-2.5 py-1 text-[8px] font-bold tracking-wider text-copper-bright ${className}`}
    >
      METAMASK <span aria-hidden="true">•</span> WALLETCONNECT <span aria-hidden="true">•</span> COINBASE
    </span>
  )
}

export function SiteFooter() {
  return (
    <footer className="container-page mt-16 pb-6 md:mt-24">
      <div className="bg-surface p-6 md:p-8">
        <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.35fr] lg:gap-0">
          {features.map((feature) => (
            <li key={feature.mark} className="flex flex-col gap-3 lg:border-r lg:border-copper lg:px-4">
              <span aria-hidden="true" className="grid size-[74px] place-items-center rounded-full bg-copper text-2xl font-bold text-ink">
                {feature.mark}
              </span>
              <h2 className="text-[17px] leading-4 font-bold">{feature.title}</h2>
              <p className="max-w-52 text-sm leading-[22px] text-sand">{feature.text}</p>
            </li>
          ))}
          <li className="lg:px-4">
            <Newsletter />
          </li>
        </ul>
      </div>

      <div className="flex flex-col gap-3 bg-band px-6 py-6 text-sm leading-[22px] sm:grid sm:grid-cols-2 md:px-8 lg:grid-cols-4 lg:items-center">
        <span className="font-bold tracking-[0.1em]">KURIO</span>
        <p>
          Feito para colecionadores,
          <br /> criadores e cultura
        </p>
        <a href="mailto:contato@email.com" className="hover:text-copper-bright">
          contato@email.com
        </a>
        <a href="tel:+551140028922" className="hover:text-copper-bright">
          +55 11 4002 8922
        </a>
      </div>

      <div className="grid gap-8 bg-surface px-6 py-8 sm:grid-cols-2 md:px-8 lg:grid-cols-4">
        <nav aria-labelledby="footer-profile">
          <h2 id="footer-profile" className="mb-2 text-lg leading-4 font-bold">
            Meu perfil
          </h2>
          <ul>
            <li>
              <Link activeOptions={{ exact: true }} to="/perfil" className={linkClass}>
                Meu perfil
              </Link>
            </li>
            <li>
              <ComingSoon className={linkClass}>Minha coleção</ComingSoon>
            </li>
            <li>
              <ComingSoon className={linkClass}>Atividade</ComingSoon>
            </li>
            <li>
              <ComingSoon className={linkClass}>Estúdio do criador</ComingSoon>
            </li>
            <li>
              <Link activeOptions={{ exact: true }} to="/perfil/favoritos" className={linkClass}>
                Lista de interesse
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-labelledby="footer-help">
          <h2 id="footer-help" className="mb-2 text-lg leading-4 font-bold">
            Central de ajuda
          </h2>
          <ul>
            {['Central de ajuda', 'Como comprar NFTs', 'Carteira e segurança', 'Política do mercado', 'Denunciar item'].map((label) => (
              <li key={label}>
                <ComingSoon className={linkClass}>{label}</ComingSoon>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-labelledby="footer-collections">
          <h2 id="footer-collections" className="mb-2 text-lg leading-4 font-bold">
            Coleções
          </h2>
          <ul>
            {collectionLinks.map((link) => (
              <li key={link.category}>
                <Link activeOptions={{ exact: true, includeHash: true }} to="/" search={{ category: link.category }} hash="catalogo" className={linkClass}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex flex-col gap-8">
          <div>
            <h2 className="mb-5 text-lg leading-4 font-bold">Redes sociais</h2>
            <ul className="flex gap-2.5">
              {socials.map(({ label, href, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${label} (abre em nova aba)`}
                    className="grid size-[30px] place-items-center rounded-sm border border-copper text-copper hover:bg-copper hover:text-ink"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="mb-3 text-lg leading-4 font-bold">Carteiras compatíveis</h2>
            <WalletsChip />
          </div>
        </div>
      </div>

      <p className="pt-3 text-center text-sm leading-[30px]">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  )
}
