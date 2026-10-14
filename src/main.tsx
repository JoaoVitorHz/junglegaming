import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/roboto-mono/latin-400.css'
import '@fontsource/roboto-mono/latin-500.css'
import '@fontsource/roboto-mono/latin-700.css'
import './index.css'

async function enableMocks() {
  if (import.meta.env.VITE_ENABLE_MOCKS !== 'true') return
  const { startMocks } = await import('./mocks/browser')
  await startMocks()
  // Sinal para automação (Playwright/Lighthouse): a camada de mocks está ativa.
  document.documentElement.dataset.mocks = 'ready'
}

async function bootstrap() {
  // App e mocks baixam em paralelo; a renderização espera os mocks para que
  // nenhuma requisição saia antes de o MSW interceptar a rede.
  const [{ App }] = await Promise.all([import('./app'), enableMocks()])
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
