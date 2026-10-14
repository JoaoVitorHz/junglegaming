import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { ExternalLink, Loader2 } from 'lucide-react'
import thankYouIcon from '@/assets/thank-you.svg'
import { toApiError } from '@/api/errors'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { OrderItems } from '@/features/checkout/order-items'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { formatEth } from '@/lib/eth'
import { networkLabels, providerLabels } from '@/lib/labels'
import { useOrder } from '@/queries/orders'
import { NotFoundPage } from './not-found-page'

const route = getRouteApi('/authed/pedidos/$orderId')

function shortHash(hash: string) {
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`.toUpperCase().replace('0X', '0x')
}

const dateFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

/**
 * Recibo (frame "Confirmação de Pedido"). Reproduz o snapshot gravado no
 * pedido — mudanças posteriores no catálogo não alteram estes valores — e só
 * é exibido para pedido efetivamente confirmado pela simulação.
 */
export function OrderPage() {
  const { orderId } = route.useParams()
  const order = useOrder(orderId)
  const navigate = useNavigate()
  useDocumentTitle('Confirmação do pedido')
  const close = () => void navigate({ to: '/' })

  if (order.isPending) {
    return (
      <div className="container-page flex justify-center py-24" aria-busy="true" aria-label="Carregando pedido">
        <Skeleton className="h-[600px] w-full max-w-[578px]" />
      </div>
    )
  }

  if (order.isError && !order.data) {
    const error = toApiError(order.error)
    if (error.code === 'NOT_FOUND' || error.code === 'FORBIDDEN') {
      return <NotFoundPage title="Pedido não encontrado" description="Este pedido não existe ou não pertence à sua conta." />
    }
    return (
      <div className="container-page py-16">
        <Alert variant="destructive" className="border-coral/40 bg-surface">
          <AlertTitle>Não foi possível carregar o pedido</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2">
            <span>{error.message}</span>
            <Button size="sm" onClick={() => void order.refetch()}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const data = order.data!

  if (data.status !== 'confirmed') {
    return (
      <div className="container-page py-16">
        <section
          role={data.status === 'rejected' ? 'alert' : 'status'}
          className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-lg bg-surface px-6 py-12 text-center"
        >
          {data.status === 'pending' ? (
            <>
              <Loader2 className="size-10 animate-spin text-copper-bright" aria-hidden="true" />
              <h1 className="text-lg font-bold">Pedido aguardando confirmação</h1>
              <p className="text-sm text-sand">O recibo aparecerá assim que a rede confirmar a transação.</p>
            </>
          ) : (
            <>
              <h1 className="text-lg font-bold text-coral">Pagamento recusado</h1>
              <p className="text-sm text-sand">{data.statusReason ?? 'A transação não foi concluída.'} Nenhum valor foi cobrado.</p>
              <Button asChild>
                <Link to="/carrinho">Voltar ao carrinho</Link>
              </Button>
            </>
          )}
        </section>
      </div>
    )
  }

  const createdAt = dateFormat.format(new Date(data.createdAt)).replace(/ de /g, ' ').replace('.', '')

  return (
    <>
      <div className="min-h-[60vh]" />
      <Dialog open onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-h-[92dvh] gap-0 overflow-y-auto rounded-none border-0 border-b-[10px] border-copper bg-surface p-0 sm:max-w-[578px]">
          <div className="flex flex-col items-center gap-4 px-6 pt-6 pb-5">
            <img src={thankYouIcon} alt="" width={80} height={80} className="size-20" />
            <DialogTitle className="text-center text-base font-bold text-sand">Seus NFTs agora estão na sua carteira</DialogTitle>
          </div>

          <dl className="grid grid-cols-2 gap-y-3 border-y border-copper px-6 py-4 text-sm sm:grid-cols-4 sm:divide-x sm:divide-copper sm:px-9">
            <div className="flex flex-col sm:pr-4">
              <dt className="font-bold text-sand">ID da transação</dt>
              <dd className="font-mono text-sand" title={data.txHash}>
                {shortHash(data.txHash)}
              </dd>
            </div>
            <div className="flex flex-col sm:px-4">
              <dt className="text-sand">Data</dt>
              <dd className="text-sand">{createdAt}</dd>
            </div>
            <div className="flex flex-col sm:px-4">
              <dt className="text-sand">Total</dt>
              <dd className="text-sand">{formatEth(data.totals.total, { minDecimals: 3 })}</dd>
            </div>
            <div className="flex flex-col sm:pl-4">
              <dt className="font-bold text-sand">Carteira</dt>
              <dd className="text-sand">{providerLabels[data.provider]}</dd>
            </div>
          </dl>

          <div className="flex flex-col gap-3 px-6 pt-6 pb-10 sm:px-11">
            <h2 className="text-[15px] font-bold">Detalhes da transação</h2>
            <OrderItems
              lines={data.items.map((i) => ({
                key: `${i.nftId}-${i.editionId}`,
                name: i.name,
                tokenId: i.tokenId,
                imageKey: i.image.key,
                quantity: i.quantity,
                lineTotal: i.lineTotal,
                editionLabel: i.editionLabel,
              }))}
            />
            <dl className="ml-auto flex w-full max-w-[320px] flex-col gap-2 border-b border-line pb-2 text-[15px]">
              {data.coupon && (
                <div className="flex justify-between">
                  <dt>Desconto ({data.coupon.code})</dt>
                  <dd className="text-mint">(-) {formatEth(data.totals.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt>Taxa de rede</dt>
                <dd className="text-lg">{formatEth(data.totals.networkFee, { minDecimals: 3 })}</dd>
              </div>
              <div className="flex justify-between font-bold">
                <dt>Total</dt>
                <dd className="text-lg text-copper-bright">{formatEth(data.totals.total, { minDecimals: 3 })}</dd>
              </div>
            </dl>
            <DialogDescription className="text-center text-sm leading-[22px] text-sand">
              Transação confirmada na {networkLabels[data.network]}. A propriedade foi transferida para sua carteira conectada e registrada na rede.
            </DialogDescription>
            <Button asChild className="mx-auto mt-2 h-12 px-4 text-base font-bold">
              <a href={data.explorerUrl} target="_blank" rel="noopener noreferrer">
                Ver no Etherscan <ExternalLink aria-hidden="true" />
                <span className="sr-only">(link simulado, abre em nova aba)</span>
              </a>
            </Button>
            <p className="text-center text-xs text-khaki">Referência de transação e link do explorador são simulados.</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
