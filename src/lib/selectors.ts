import type { Account, Category, Transaction } from './types'
import { addDays, addMonths, daysInMonth, monthKey } from './dates'

export function inMonth(txs: Transaction[], month: string): Transaction[] {
  return txs.filter((t) => monthKey(t.date) === month)
}

export interface Totals {
  income: number
  expense: number
  net: number
  /** null si no hubo ingresos */
  savingsRate: number | null
}

export function totals(txs: Transaction[]): Totals {
  let income = 0
  let expense = 0
  for (const t of txs) {
    if (t.type === 'income') income += t.amount
    else if (t.type === 'expense') expense += t.amount
  }
  return { income, expense, net: income - expense, savingsRate: income > 0 ? (income - expense) / income : null }
}

export function spendByCategory(txs: Transaction[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const t of txs) {
    if (t.type !== 'expense' || !t.categoryId) continue
    map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount)
  }
  return map
}

export function incomeByCategory(txs: Transaction[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const t of txs) {
    if (t.type !== 'income' || !t.categoryId) continue
    map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount)
  }
  return map
}

/** Gasto acumulado por día del mes: [día1, día1+día2, ...]. */
export function cumulativeDaily(txs: Transaction[], month: string): number[] {
  const days = new Array(daysInMonth(month)).fill(0)
  for (const t of txs) {
    if (t.type !== 'expense' || monthKey(t.date) !== month) continue
    days[Number(t.date.slice(8, 10)) - 1] += t.amount
  }
  for (let i = 1; i < days.length; i++) days[i] += days[i - 1]
  return days
}

export function accountBalances(accounts: Account[], txs: Transaction[]): Map<string, number> {
  const map = new Map(accounts.map((a) => [a.id, a.startingBalance]))
  const add = (id: string | undefined, v: number) => {
    if (id && map.has(id)) map.set(id, map.get(id)! + v)
  }
  for (const t of txs) {
    if (t.type === 'income') add(t.accountId, t.amount)
    else if (t.type === 'expense') add(t.accountId, -t.amount)
    else {
      add(t.accountId, -t.amount)
      add(t.toAccountId, t.amount)
    }
  }
  return map
}

export interface MonthPoint {
  month: string
  income: number
  expense: number
}

export function monthSeries(txs: Transaction[], endMonth: string, n: number): MonthPoint[] {
  const months = Array.from({ length: n }, (_, i) => addMonths(endMonth, i - n + 1))
  const index = new Map(months.map((m, i) => [m, i]))
  const out: MonthPoint[] = months.map((month) => ({ month, income: 0, expense: 0 }))
  for (const t of txs) {
    const i = index.get(monthKey(t.date))
    if (i === undefined) continue
    if (t.type === 'income') out[i].income += t.amount
    else if (t.type === 'expense') out[i].expense += t.amount
  }
  return out
}

export function categoryHistory(txs: Transaction[], categoryId: string, endMonth: string, n: number) {
  const months = Array.from({ length: n }, (_, i) => addMonths(endMonth, i - n + 1))
  const index = new Map(months.map((m, i) => [m, i]))
  const out = months.map((month) => ({ month, amount: 0 }))
  for (const t of txs) {
    if (t.categoryId !== categoryId) continue
    const i = index.get(monthKey(t.date))
    if (i !== undefined) out[i].amount += t.amount
  }
  return out
}

export interface DayGroup {
  date: string
  items: Transaction[]
  /** Neto del día: ingresos - gastos */
  net: number
}

/** Agrupa por día, más reciente primero. */
export function groupByDay(txs: Transaction[]): DayGroup[] {
  const sorted = [...txs].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))
  const groups: DayGroup[] = []
  for (const t of sorted) {
    let g = groups[groups.length - 1]
    if (!g || g.date !== t.date) {
      g = { date: t.date, items: [], net: 0 }
      groups.push(g)
    }
    g.items.push(t)
    if (t.type === 'income') g.net += t.amount
    else if (t.type === 'expense') g.net -= t.amount
  }
  return groups
}

export function totalBudget(categories: Category[]): number {
  return categories.reduce((s, c) => s + (c.kind === 'expense' && c.budget ? c.budget : 0), 0)
}

export type BudgetStatus = 'ok' | 'warn' | 'over'

/**
 * Estado del presupuesto comparando lo gastado con el ritmo esperado del mes.
 * Ej: día 10 de 30 con 50% gastado -> "warn".
 */
export function budgetStatus(spent: number, budget: number, dayOfMonth: number, totalDays: number): BudgetStatus {
  if (spent > budget) return 'over'
  const pace = dayOfMonth / totalDays
  if (spent / budget > pace + 0.15) return 'warn'
  return 'ok'
}

/** Efecto de un movimiento sobre un conjunto de cuentas (para saldos y patrimonio). */
function effectOn(t: Transaction, ids: Set<string>): number {
  if (t.type === 'income') return ids.has(t.accountId) ? t.amount : 0
  if (t.type === 'expense') return ids.has(t.accountId) ? -t.amount : 0
  return (ids.has(t.toAccountId ?? '') ? t.amount : 0) - (ids.has(t.accountId) ? t.amount : 0)
}

/** Saldo al cierre de cada día de los últimos `days` días (patrimonio o una cuenta). */
export function balanceSeries(
  accounts: Account[],
  txs: Transaction[],
  days: number,
  today: string,
  accountId?: string,
): { date: string; value: number }[] {
  const ids = new Set(accountId ? [accountId] : accounts.map((a) => a.id))
  let running = accounts.filter((a) => ids.has(a.id)).reduce((s, a) => s + a.startingBalance, 0)
  const start = addDays(today, -(days - 1))
  const byDay = new Map<string, number>()
  for (const t of txs) {
    if (t.date > today) continue
    const e = effectOn(t, ids)
    if (!e) continue
    if (t.date < start) running += e
    else byDay.set(t.date, (byDay.get(t.date) ?? 0) + e)
  }
  const out: { date: string; value: number }[] = []
  for (let i = 0, d = start; i < days; i++, d = addDays(d, 1)) {
    running += byDay.get(d) ?? 0
    out.push({ date: d, value: running })
  }
  return out
}

/** Cambio neto de una cuenta dentro de un mes. */
export function accountMonthChange(txs: Transaction[], accountId: string, month: string): number {
  const ids = new Set([accountId])
  return txs.reduce((s, t) => (monthKey(t.date) === month ? s + effectOn(t, ids) : s), 0)
}
