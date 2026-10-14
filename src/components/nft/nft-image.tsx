import { cn } from '@/lib/utils'
import { NFT_IMAGE_WIDTHS as WIDTHS, nftImageSrc } from '@/lib/nft-image'

interface NftImageProps extends Omit<React.ComponentProps<'img'>, 'src' | 'srcSet'> {
  imageKey: string
  alt: string
  /** Atributo `sizes` do srcset; ajuda o navegador a baixar só o necessário. */
  sizes: string
  priority?: boolean
}

/** Imagem de NFT responsiva (WebP 160/480/960 px), quadrada e sem layout shift. */
export function NftImage({ imageKey, alt, sizes, priority = false, className, ...props }: NftImageProps) {
  return (
    <img
      src={nftImageSrc(imageKey, 480)}
      srcSet={WIDTHS.map((w) => `${nftImageSrc(imageKey, w)} ${w}w`).join(', ')}
      sizes={sizes}
      alt={alt}
      width={480}
      height={480}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      fetchPriority={priority ? 'high' : 'auto'}
      className={cn('aspect-square object-cover', className)}
      {...props}
    />
  )
}
