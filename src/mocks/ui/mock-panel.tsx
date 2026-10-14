/**
 * Painel de simulação (parte da camada de mocks, carregado apenas quando
 * VITE_ENABLE_MOCKS=true). Não contém respostas fictícias: apenas chama os
 * endpoints de controle `/api/__mock/*`, que alteram o servidor simulado —
 * os efeitos chegam à aplicação pelas mesmas rotas REST e eventos Socket.IO.
 */
import { FlaskConical, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { http } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import { errorMessage } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import type { ScenarioPreset } from '../scenarios'

interface MockState {
  presets: string[]
  available: ScenarioPreset[]
  sockets: number
}

async function call(path: string, body?: unknown, method: 'post' | 'put' = 'post') {
  const { data } = await http.request({ url: path, method, data: body ?? {} })
  return data
}

export default function MockPanel() {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<MockState | null>(null)

  useEffect(() => {
    if (!open) return
    let active = true
    http
      .get<MockState>(endpoints.mock.state)
      .then(({ data }) => active && setState(data))
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [open])

  async function toggle(id: string, checked: boolean) {
    if (!state) return
    const presets = checked ? [...state.presets, id] : state.presets.filter((p) => p !== id)
    await call(endpoints.mock.scenario, { presets }, 'put')
    setState({ ...state, presets })
  }

  async function run(label: string, path: string, body?: unknown) {
    try {
      await call(path, body)
      toast.info(`Simulação: ${label}`)
    } catch (error) {
      toast.error(`Simulação falhou: ${errorMessage(error)}`)
    }
  }

  async function reset() {
    await call(endpoints.mock.reset, { presets: [] })
    // O seed não conhece sessões nem carrinhos anteriores: o cliente recomeça do zero.
    for (const key of Object.keys(localStorage)) if (key.startsWith('kurio:') && !key.startsWith('kurio:mock:')) localStorage.removeItem(key)
    sessionStorage.clear()
    window.location.reload()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="fixed bottom-4 left-4 z-40 gap-1.5 border-line-strong bg-surface text-xs max-md:bottom-24"
          aria-label="Abrir painel de simulação"
        >
          <FlaskConical aria-hidden="true" /> Simulação
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-85 overflow-y-auto border-line-strong bg-surface sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Simulação (MSW)</SheetTitle>
          <SheetDescription>
            Cenários de rede e de negócio aplicados pela camada de mocks. Conexões de tempo real ativas: {state?.sockets ?? '–'}.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-6">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-bold">Cenários ativos</legend>
            {state?.available.map((preset) => (
              <div key={preset.id} className="flex items-start gap-2">
                <Checkbox
                  id={`mock-${preset.id}`}
                  checked={state.presets.includes(preset.id)}
                  onCheckedChange={(checked) => void toggle(preset.id, checked === true)}
                  className="mt-0.5"
                />
                <Label htmlFor={`mock-${preset.id}`} className="flex flex-col items-start gap-0.5 font-normal">
                  <span className="text-sm text-cream">{preset.label}</span>
                  <span className="text-xs text-sand">{preset.description}</span>
                </Label>
              </div>
            ))}
          </fieldset>

          <Separator />

          <div className="flex flex-col gap-2">
            <p className="text-sm font-bold">Eventos e falhas</p>
            <Button variant="secondary" size="sm" onClick={() => run('preço do 1º item do carrinho +0,15 ETH', endpoints.mock.nftUpdate, { fromCart: true, priceDelta: '0.15' })}>
              Subir preço do 1º item do carrinho
            </Button>
            <Button variant="secondary" size="sm" onClick={() => run('edição do 1º item esgotada', endpoints.mock.nftUpdate, { fromCart: true, soldOut: true })}>
              Esgotar edição do 1º item do carrinho
            </Button>
            <Button variant="secondary" size="sm" onClick={() => run('último evento reenviado', endpoints.mock.replayEvent, { mode: 'last' })}>
              Reenviar último evento (duplicado)
            </Button>
            <Button variant="secondary" size="sm" onClick={() => run('evento antigo reenviado', endpoints.mock.replayEvent, { mode: 'stale' })}>
              Reenviar evento antigo
            </Button>
            <Button variant="secondary" size="sm" onClick={() => run('tempo real desconectado por 5 s', endpoints.mock.socketDisconnect, { blockMs: 5000 })}>
              Derrubar tempo real por 5 s
            </Button>
            <Button variant="secondary" size="sm" onClick={() => run('sessão expirada no servidor', endpoints.mock.expireSession)}>
              Expirar sessão no servidor
            </Button>
          </div>

          <Separator />

          <Button variant="outline" onClick={() => void reset()}>
            <RotateCcw aria-hidden="true" /> Restaurar cenário padrão
          </Button>
          <p className="text-xs text-sand">
            Restaura o banco simulado (seed), limpa cenários e recarrega a página. Usuários: colecionador@kurio.dev e
            artista@kurio.dev, senha Kurio@2026.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
