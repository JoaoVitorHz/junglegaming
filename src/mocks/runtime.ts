/**
 * Estado em tempo de execução da simulação que não pertence ao banco:
 * cenário ativo e timers agendados (liquidação de pedidos, desconexões).
 */
import { loadScenarioPresets, resolveScenario, saveScenarioPresets, type ScenarioConfig } from './scenarios'

let presets: string[] = typeof window === 'undefined' ? [] : loadScenarioPresets()
let scenario: ScenarioConfig = resolveScenario(presets)

export function getScenario(): ScenarioConfig {
  return scenario
}

export function getScenarioPresets(): string[] {
  return presets
}

export function setScenarioPresets(ids: string[]) {
  presets = ids
  scenario = resolveScenario(ids)
  saveScenarioPresets(ids)
}

const timers = new Set<ReturnType<typeof setTimeout>>()

export function schedule(fn: () => void, ms: number) {
  const handle = setTimeout(() => {
    timers.delete(handle)
    fn()
  }, ms)
  timers.add(handle)
  return handle
}

export function clearScheduled() {
  for (const handle of timers) clearTimeout(handle)
  timers.clear()
}
