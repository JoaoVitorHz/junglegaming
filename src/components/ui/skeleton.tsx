import { cn } from "@/lib/utils"

/**
 * Skeleton com efeito shimmer (gradiente animado). A animação é desligada
 * automaticamente quando o usuário prefere movimento reduzido (ver index.css).
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("shimmer rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton }
