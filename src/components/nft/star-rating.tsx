import { Star } from 'lucide-react'

export function StarRating({ rating, count }: { rating: number; count: number }) {
  return (
    <p className="flex items-center gap-1 text-[15px]">
      <span className="flex" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} className={`size-4 ${i < Math.round(rating) ? 'fill-sand text-sand' : 'text-khaki'}`} />
        ))}
      </span>
      <span className="sr-only">Nota {rating.toLocaleString('pt-BR')} de 5,</span>
      {count} avaliações de colecionadores
    </p>
  )
}
