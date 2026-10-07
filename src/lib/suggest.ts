import type { Transaction, TxType } from './types'
import { addDays } from './dates'
import { normalizeMerchant } from './rules'

export interface MerchantSuggestion {
  name: string
  categoryId: string | null
  accountId: string
  /** Monto más reciente, por si se repite igual (el tinto, el bus). */
  lastAmount: number
  count: number
}

/**
 * Comercios que más usas en los últimos 120 días, con la cuenta y la categoría
 * de la última vez: tocarlos llena casi todo el formulario.
 */
export function frequentMerchants(txs: Transaction[], type: TxType, today: string, limit = 8): MerchantSuggestion[] {
  const since = addDays(today, -120)
  const map = new Map<string, MerchantSuggestion & { last: string }>()
  for (const t of txs) {
    if (t.type !== type || !t.name || t.date < since) continue
    const k = normalizeMerchant(t.name)
    if (!k) continue
    const cur = map.get(k)
    if (!cur) {
      map.set(k, { name: t.name, categoryId: t.categoryId, accountId: t.accountId, lastAmount: t.amount, count: 1, last: t.date })
    } else {
      cur.count++
      if (t.date > cur.last) Object.assign(cur, { categoryId: t.categoryId, accountId: t.accountId, lastAmount: t.amount, last: t.date })
    }
  }
  return [...map.values()]
    .sort((a, b) => b.count - a.count || (a.last < b.last ? 1 : -1))
    .slice(0, limit)
    .map(({ last: _last, ...m }) => m)
}

/** Categorías más usadas (para mostrar 6 y no 13: menos decisiones). */
export function topCategories(txs: Transaction[], kind: 'expense' | 'income', today: string, limit = 6): string[] {
  const since = addDays(today, -120)
  const counts = new Map<string, number>()
  for (const t of txs) {
    if (t.type !== kind || !t.categoryId || t.date < since) continue
    counts.set(t.categoryId, (counts.get(t.categoryId) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id)
}
