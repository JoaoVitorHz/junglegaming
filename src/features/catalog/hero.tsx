import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import type { NftSummary } from '@/api/contracts'
import { NftImage } from '@/components/nft/nft-image'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface HeroProps {
  items: NftSummary[] | undefined
  isLoading: boolean
}

/**
 * Hero com destaques. Desktop: texto à esquerda e arte 450×450 à direita.
 * Mobile: banner compacto do frame "Mobile / Início".
 * A troca de destaque é manual (sem autoplay), para não mover conteúdo sem
 * ação do usuário.
 */
export function Hero({ items, isLoading }: HeroProps) {
  const [index, setIndex] = useState(0)
  const current = items?.[index] ?? items?.[0]
  const secondary = items?.[(index + 1) % (items?.length || 1)]

  return (
    <section
      aria-labelledby="hero-title"
      aria-roledescription="carrossel"
      className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-copper/20 to-copper/10 p-4 md:rounded-none md:bg-none md:p-0"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-8 -left-20 size-62 rounded-full bg-gradient-to-br from-[#dd9a5f]/40 to-transparent md:hidden"
      />
      <div className="relative flex items-center gap-2 md:gap-10 md:pl-6 lg:gap-[110px] lg:pl-10">
        <div className="flex min-w-0 flex-1 flex-col gap-4 md:gap-11">
          <div className="flex flex-col gap-1.5 md:gap-8">
            <div className="flex flex-col gap-1.5 md:gap-2">
              <p className="text-xs leading-4 font-medium md:text-sm md:tracking-[0.1em]">Bem-vindo à Kurio</p>
              <h1 id="hero-title" className="text-lg leading-[29px] font-bold md:text-[32px] md:leading-[52px] lg:text-[43px] lg:leading-[70px]">
                <span className="md:hidden">
                  SEJA DONO DA
                  <br />
                  CULTURA DIGITAL
                </span>
                <span className="max-md:hidden">
                  SEJA DONO DO FUTURO
                  <br />
                  DA ARTE DIGITAL
                </span>
              </h1>
              <p className="max-w-[557px] text-xs leading-[18px] text-sand md:text-sm md:leading-6">
                Descubra NFTs selecionados de criadores emergentes e consagrados.
                <span className="max-md:hidden">
                  {' '}
                  Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.
                </span>
              </p>
            </div>
            <Link activeOptions={{ exact: true, includeHash: true }}
              to="/"
              hash="catalogo"
              className="flex w-fit items-center gap-2 text-xs font-bold text-copper-bright md:h-10 md:rounded-md md:bg-copper md:px-9 md:pl-7 md:text-base md:text-ink md:hover:bg-copper/90"
            >
              EXPLORAR
              <ArrowRight className="size-4 md:hidden" aria-hidden="true" />
            </Link>
          </div>
          {items && items.length > 1 && (
            <div role="group" aria-label="Escolher destaque" className="flex gap-1.5 self-center md:gap-2 md:self-end">
              {items.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Destaque ${i + 1} de ${items.length}: ${item.name}`}
                  aria-current={i === index ? 'true' : undefined}
                  className="grid size-6 place-items-center"
                >
                  <span className={cn('size-[7px] rounded-full bg-copper transition-transform md:size-2', i === index && 'scale-150')} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative shrink-0">
          {isLoading || !current ? (
            <Skeleton className="size-[138px] rounded-2xl md:size-[300px] md:rounded-3xl lg:size-[450px]" />
          ) : (
            <Link activeOptions={{ exact: true }} to="/nft/$slug" params={{ slug: current.slug }} aria-label={`Ver ${current.name}`} className="block">
              <NftImage
                key={current.id}
                imageKey={current.image.key}
                alt={current.image.alt}
                sizes="(min-width: 1024px) 450px, (min-width: 768px) 300px, 138px"
                priority
                className="size-[138px] rounded-2xl md:size-[300px] md:rounded-3xl lg:size-[450px]"
              />
            </Link>
          )}
          {secondary && current && secondary.id !== current.id && (
            <NftImage
              imageKey={secondary.image.key}
              alt=""
              sizes="58px"
              className="absolute -bottom-2 left-3.5 size-[58px] rounded-2xl border-2 border-surface md:hidden"
            />
          )}
        </div>
      </div>
    </section>
  )
}

export function Spotlight({ nft }: { nft: NftSummary | undefined }) {
  if (!nft) return <Skeleton className="hidden h-[470px] w-full md:block" />
  return (
    <section aria-labelledby="spotlight-title" className="relative hidden flex-col gap-4 bg-gradient-to-b from-copper/10 to-copper/[0.03] pt-6 md:flex">
      <div className="flex flex-col gap-4 px-5">
        <h2 id="spotlight-title" className="text-2xl leading-8 font-bold text-copper-bright">
          NFT EM DESTAQUE
        </h2>
        <p className="text-[22px] leading-4 font-bold">OFERTA LIMITADA</p>
      </div>
      <Link activeOptions={{ exact: true }} to="/nft/$slug" params={{ slug: nft.slug }} className="group block" aria-label={`${nft.name}, oferta limitada`}>
        <NftImage
          imageKey={nft.image.key}
          alt={nft.image.alt}
          sizes="310px"
          className="aspect-[310/368] w-full rounded-[22px] object-cover transition-transform group-hover:scale-[1.01]"
        />
      </Link>
    </section>
  )
}
