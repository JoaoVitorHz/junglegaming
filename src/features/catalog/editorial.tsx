import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { ComingSoon } from '@/components/layout/coming-soon'
import { NftImage } from '@/components/nft/nft-image'
import { artAlt } from '@/lib/art'

const promos = [
  {
    title: ['Lançamentos gênesis', 'de edição limitada'],
    text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
    image: 'emerald',
    search: { tab: 'new' as const },
  },
  {
    title: ['Arte digital selecionada', 'e muito mais'],
    text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.',
    image: 'ivory',
    search: { category: 'arte-digital' },
  },
]

export function Promos() {
  return (
    <section aria-label="Coleções em destaque" className="grid gap-4 md:grid-cols-2 md:gap-7">
      {promos.map((promo) => (
        <article key={promo.image} className="relative flex min-h-[200px] overflow-hidden rounded-lg bg-surface md:h-[250px]">
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-48 size-64 rounded-full border-2 border-copper" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-34 -left-50 size-64 rounded-full border border-copper" />
          <NftImage imageKey={promo.image} alt={artAlt[promo.image as keyof typeof artAlt]} sizes="(min-width: 768px) 292px, 40vw" className="relative w-2/5 shrink-0 rounded-[18px] object-cover md:w-[292px]" />
          <div className="relative flex flex-1 flex-col items-end justify-between gap-3 p-4 text-right md:py-9 md:pr-7">
            <div className="flex flex-col gap-3">
              <h2 className="text-base leading-6 font-bold md:text-lg">
                {promo.title[0]}
                <br />
                {promo.title[1]}
              </h2>
              <p className="text-xs leading-5 text-sand md:text-sm md:leading-6">{promo.text}</p>
            </div>
            <Link activeOptions={{ exact: true, includeHash: true }}
              to="/"
              search={promo.search}
              hash="catalogo"
              className="inline-flex h-10 w-[140px] items-center justify-center gap-1 rounded-md bg-copper text-sm font-medium text-ink hover:bg-copper/90"
            >
              Explorar <ArrowRight className="size-4" aria-hidden="true" />
              <span className="sr-only">{promo.title.join(' ')}</span>
            </Link>
          </div>
        </article>
      ))}
    </section>
  )
}

const posts = [
  { date: '12 de setembro', read: 6, title: 'Como funciona a propriedade de NFTs', text: 'Aprenda a colecionar, negociar e verificar ativos digitais.', image: 'ivory' },
  { date: '13 de setembro', read: 2, title: '10 artistas digitais para acompanhar', text: 'Conheça criadores que moldam a cultura digital.', image: 'emerald' },
  { date: '15 de setembro', read: 3, title: 'Raridade, atributos e procedência', text: 'Entenda raridade, procedência, direitos autorais e utilidade.', image: 'sage' },
  { date: '15 de setembro', read: 2, title: 'Como proteger sua carteira', text: 'Proteja sua carteira, seus ativos e sua identidade.', image: 'golden' },
]

export function Journal() {
  return (
    <section aria-labelledby="journal-title" className="flex flex-col gap-10">
      <header className="flex flex-col gap-3 text-center">
        <h2 id="journal-title" className="text-2xl leading-9 font-bold md:text-[28px]">
          Diário da Cunhagem
        </h2>
        <p className="text-sm leading-[18px] text-sand">Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p>
      </header>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {posts.map((post) => (
          <li key={post.title}>
            <article className="flex h-full flex-col overflow-hidden rounded-lg bg-surface">
              <img
                src={`/nfts/${post.image}-480.webp`}
                alt=""
                width={480}
                height={350}
                loading="lazy"
                decoding="async"
                className="aspect-[268/195] w-full object-cover object-top"
              />
              <div className="flex flex-1 flex-col gap-2 px-4 pt-3 pb-4">
                <p className="text-xs leading-4 font-medium text-sand">
                  {post.date} <span aria-hidden="true">|</span> <span className="sr-only">,</span> Leitura de {post.read} min
                </p>
                <h3 className="text-base leading-[21px] font-bold">{post.title}</h3>
                <p className="text-xs leading-4 font-medium text-sand">{post.text}</p>
                <ComingSoon className="mt-auto w-fit text-xs font-bold text-copper-bright">
                  Ler mais <span aria-hidden="true">→</span>
                  <span className="sr-only">: {post.title}</span>
                </ComingSoon>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}
