/**
 * Configuração versionada da auditoria Lighthouse.
 * Páginas: Início e Detalhe do NFT; perfis mobile e desktop; 3 medições cada.
 * Build otimizado (vite build + vite preview) com o cenário padrão dos mocks.
 */
import desktopConfig from 'lighthouse/core/config/desktop-config.js'

export const PORT = 4174
export const RUNS = 3
export const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo']

export const PAGES = [
  { id: 'inicio', path: '/' },
  { id: 'detalhe', path: '/nft/emerald-ape-042' },
]

/** Perfil mobile = padrão do Lighthouse (Moto G Power, 4G lenta simulada, CPU 4×). */
const mobile = {
  extends: 'lighthouse:default',
  settings: { onlyCategories: CATEGORIES, formFactor: 'mobile' },
}

/** Perfil desktop = preset oficial do Lighthouse (sem throttling de CPU, rede cabeada). */
const desktop = {
  ...desktopConfig,
  settings: { ...desktopConfig.settings, onlyCategories: CATEGORIES },
}

export const PROFILES = [
  { id: 'mobile', config: mobile },
  { id: 'desktop', config: desktop },
]

export const METRICS = [
  { id: 'largest-contentful-paint', label: 'LCP' },
  { id: 'cumulative-layout-shift', label: 'CLS' },
  { id: 'total-blocking-time', label: 'TBT' },
  { id: 'first-contentful-paint', label: 'FCP' },
  { id: 'speed-index', label: 'SI' },
]
