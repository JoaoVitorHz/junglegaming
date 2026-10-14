import type { ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/**
 * Ação fora do escopo desta entrega (páginas editoriais, suporte etc.).
 * Fica visível para preservar o layout, mas é anunciada como indisponível e
 * não simula sucesso.
 */
export function ComingSoon({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-disabled="true"
          aria-describedby={undefined}
          onClick={(e) => e.preventDefault()}
          className={cn('cursor-not-allowed text-left opacity-80', className)}
        >
          {children}
          <span className="sr-only"> (em breve)</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>Disponível em breve</TooltipContent>
    </Tooltip>
  )
}
