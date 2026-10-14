import { NftImage } from '@/components/nft/nft-image'
import { formatEth } from '@/lib/eth'

export interface OrderLine {
  key: string
  name: string
  tokenId: string
  imageKey: string
  quantity: number
  lineTotal: string
  editionLabel?: string
}

/** Lista "Seus NFTs" do pagamento / "Detalhes da transação" do recibo. */
export function OrderItems({ lines, quantityLabel = 'Edições' }: { lines: OrderLine[]; quantityLabel?: string }) {
  return (
    <table className="w-full border-separate border-spacing-y-3 text-left">
      <thead>
        <tr className="text-base font-bold">
          <th scope="col" className="pb-1 font-bold">
            NFTs
          </th>
          <th scope="col" className="pb-1 text-center font-bold">
            <span className="sr-only">{quantityLabel}</span>
          </th>
          <th scope="col" className="pb-1 text-right font-bold">
            Subtotal
          </th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => (
          <tr key={line.key} className="bg-surface">
            <td className="py-1 pl-1">
              <div className="flex items-center gap-2">
                <NftImage imageKey={line.imageKey} alt="" sizes="65px" className="size-[65px] shrink-0 rounded-md" />
                <div className="min-w-0">
                  <p className="truncate text-base font-bold">{line.name}</p>
                  <p className="text-sm text-khaki">
                    ID do token: {line.tokenId}
                    {line.editionLabel && <span className="sr-only">, edição {line.editionLabel}</span>}
                  </p>
                </div>
              </div>
            </td>
            <td className="px-2 text-center text-sm whitespace-nowrap text-sand">
              <span aria-hidden="true">(x {line.quantity})</span>
              <span className="sr-only">{line.quantity} unidades</span>
            </td>
            <td className="pr-3 text-right text-lg font-bold whitespace-nowrap text-copper-bright">{formatEth(line.lineTotal)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
