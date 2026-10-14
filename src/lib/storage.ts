/** Acesso a storage que nunca lança (modo privado, cota cheia, storage bloqueado). */
function safe(storage: () => Storage) {
  return {
    get<T>(key: string): T | null {
      try {
        const raw = storage().getItem(key)
        return raw ? (JSON.parse(raw) as T) : null
      } catch {
        return null
      }
    },
    set(key: string, value: unknown) {
      try {
        storage().setItem(key, JSON.stringify(value))
      } catch {
        /* sem persistência disponível */
      }
    },
    remove(key: string) {
      try {
        storage().removeItem(key)
      } catch {
        /* sem persistência disponível */
      }
    },
  }
}

export const local = safe(() => window.localStorage)
export const session = safe(() => window.sessionStorage)

export function randomId(prefix: string) {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `${prefix}_${uuid}`
}
