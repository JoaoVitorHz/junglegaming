import { Outlet } from '@tanstack/react-router'

export function AppLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <main id="conteudo" className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
