export const NFT_IMAGE_WIDTHS = [160, 480, 960] as const

export function nftImageSrc(key: string, width: (typeof NFT_IMAGE_WIDTHS)[number] = 480) {
  return `/nfts/${key}-${width}.webp`
}
