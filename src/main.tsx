import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/roboto-mono/latin-400.css'
import '@fontsource/roboto-mono/latin-500.css'
import '@fontsource/roboto-mono/latin-700.css'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main className="container-page py-10">
      <h1 className="text-3xl font-bold tracking-wide">KURIO</h1>
    </main>
  </StrictMode>,
)
