/**
 * Schemas dos search params. Valores inválidos na URL caem no padrão em vez
 * de quebrar a página (ex.: `?page=abc` vira página 1).
 */
import { z } from 'zod'
import { catalogTabs, categories, networks, sortOptions, type Category, type Network, type NftListQuery } from '@/api/contracts'
import { isEthString } from '@/lib/eth'

const optionalString = z.string().trim().optional().catch(undefined)
const ethParam = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine(isEthString)
  .optional()
  .catch(undefined)

export const catalogSearchSchema = z.object({
  q: optionalString,
  /** Lista separada por vírgula, ex.: `arte-digital,musica`. */
  category: optionalString,
  network: optionalString,
  minPrice: ethParam,
  maxPrice: ethParam,
  sort: z.enum(sortOptions).optional().catch(undefined),
  tab: z.enum(catalogTabs).optional().catch(undefined),
  page: z.coerce.number().int().positive().optional().catch(undefined),
})
export type CatalogSearch = z.infer<typeof catalogSearchSchema>

export const CATALOG_PAGE_SIZE = 9

function splitList<T extends string>(value: string | undefined, allowed: readonly T[]): T[] {
  if (!value) return []
  return value.split(',').filter((v): v is T => (allowed as readonly string[]).includes(v))
}

export function parseCategories(value?: string): Category[] {
  return splitList(value, categories)
}

export function parseNetworks(value?: string): Network[] {
  return splitList(value, networks)
}

/** Converte a URL do catálogo na consulta enviada à API (fonte única da consulta). */
export function toNftListQuery(search: CatalogSearch): NftListQuery {
  return {
    q: search.q || undefined,
    categories: parseCategories(search.category),
    networks: parseNetworks(search.network),
    minPrice: search.minPrice,
    maxPrice: search.maxPrice,
    sort: search.sort ?? 'recent',
    tab: search.tab ?? 'all',
    page: search.page ?? 1,
    pageSize: CATALOG_PAGE_SIZE,
  }
}

export const authSearchSchema = z.object({
  redirect: z.string().startsWith('/').optional().catch(undefined),
  reason: z.enum(['expired', 'required']).optional().catch(undefined),
})
export type AuthSearch = z.infer<typeof authSearchSchema>
