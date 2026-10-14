/**
 * Aritmética de valores em ETH sem perda de precisão.
 *
 * Os valores trafegam como strings decimais (ex.: "1.19", "0.016") e são
 * convertidos para wei (bigint, 18 casas) em qualquer cálculo. Nunca usamos
 * `number` para dinheiro: 0.1 + 0.2 em ponto flutuante não é 0.3.
 */

export const ETH_DECIMALS = 18
const WEI_PER_ETH = 10n ** BigInt(ETH_DECIMALS)
const DECIMAL_RE = /^-?\d+(\.\d+)?$/

export type Wei = bigint

export function isEthString(value: string): boolean {
  return DECIMAL_RE.test(value.trim())
}

export function toWei(value: string): Wei {
  const trimmed = value.trim()
  if (!DECIMAL_RE.test(trimmed)) {
    throw new Error(`Valor ETH inválido: "${value}"`)
  }
  const negative = trimmed.startsWith('-')
  const [intPart = '0', fracPart = ''] = trimmed.replace('-', '').split('.')
  if (fracPart.length > ETH_DECIMALS) {
    throw new Error(`Valor ETH com mais de ${ETH_DECIMALS} casas: "${value}"`)
  }
  const wei = BigInt(intPart) * WEI_PER_ETH + BigInt(fracPart.padEnd(ETH_DECIMALS, '0'))
  return negative ? -wei : wei
}

/** Converte wei para string decimal canônica, sem zeros à direita ("1.5", "2", "0.016"). */
export function fromWei(wei: Wei): string {
  const negative = wei < 0n
  const abs = negative ? -wei : wei
  const intPart = abs / WEI_PER_ETH
  const frac = (abs % WEI_PER_ETH).toString().padStart(ETH_DECIMALS, '0').replace(/0+$/, '')
  const body = frac ? `${intPart}.${frac}` : intPart.toString()
  return negative ? `-${body}` : body
}

export function addEth(...values: string[]): string {
  return fromWei(values.reduce((acc, v) => acc + toWei(v), 0n))
}

export function subEth(a: string, b: string): string {
  return fromWei(toWei(a) - toWei(b))
}

export function mulEth(value: string, quantity: number): string {
  if (!Number.isInteger(quantity)) throw new Error('Quantidade deve ser inteira')
  return fromWei(toWei(value) * BigInt(quantity))
}

/** Aplica um percentual expresso em basis points (1000 = 10%), arredondando para baixo em wei. */
export function percentOfEth(value: string, basisPoints: number): string {
  if (!Number.isInteger(basisPoints)) throw new Error('Basis points deve ser inteiro')
  return fromWei((toWei(value) * BigInt(basisPoints)) / 10_000n)
}

export function compareEth(a: string, b: string): -1 | 0 | 1 {
  const diff = toWei(a) - toWei(b)
  return diff === 0n ? 0 : diff > 0n ? 1 : -1
}

export function maxEth(a: string, b: string): string {
  return compareEth(a, b) >= 0 ? a : b
}

/**
 * Formata para exibição. Por padrão mantém no mínimo 2 casas (padrão do Figma:
 * "1.19 ETH", "26.846 ETH") e não arredonda além do que existe no valor —
 * o resumo deve bater exatamente com a resposta da API.
 */
export function formatEth(
  value: string,
  { minDecimals = 2, maxDecimals = ETH_DECIMALS, unit = true }: { minDecimals?: number; maxDecimals?: number; unit?: boolean } = {},
): string {
  const canonical = fromWei(toWei(value))
  const negative = canonical.startsWith('-')
  const [intPart = '0', fracRaw = ''] = canonical.replace('-', '').split('.')
  let frac = fracRaw.slice(0, maxDecimals)
  if (frac.length < minDecimals) frac = frac.padEnd(minDecimals, '0')
  const body = frac ? `${intPart}.${frac}` : intPart
  return `${negative ? '-' : ''}${body}${unit ? ' ETH' : ''}`
}
