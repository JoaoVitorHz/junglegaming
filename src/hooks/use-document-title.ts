import { useEffect } from 'react'

const BASE = 'Kurio — Marketplace de NFTs'

/** Atualiza o título da aba (também anunciado por leitores de tela ao navegar). */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} | Kurio` : BASE
  }, [title])
}
