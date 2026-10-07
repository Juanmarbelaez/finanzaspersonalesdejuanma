import type { Recurring } from './types'
import { addDays, addMonths, daysInMonth } from './dates'

/**
 * Ritmo esperado de gasto que respeta los pagos fijos.
 * Sin esto, el arriendo del día 5 hace que todo mes arranque "en rojo".
 * Modelo: lo esperado al día d = pagos fijos programados hasta d
 *                               + (presupuesto - fijos) × d / días del mes.
 */

/** Fechas (YYYY-MM-DD) en que cae un recurrente dentro de un mes. */
export function occurrencesInMonth(r: Recurring, month: string): string[] {
  const start = `${month}-01`
  const end = `${month}-${String(daysInMonth(month)).padStart(2, '0')}`
  if (r.frequency === 'monthly') {
    return [`${month}-${String(Math.min(r.anchorDay, daysInMonth(month))).padStart(2, '0')}`]
  }
  if (r.frequency === 'yearly') {
    // Mismo mes del año que el próximo cobro
    if (r.nextDate.slice(5, 7) !== month.slice(5, 7)) return []
    return [`${month}-${String(Math.min(r.anchorDay, daysInMonth(month))).padStart(2, '0')}`]
  }
  const step = r.frequency === 'weekly' ? 7 : 14
  let d = r.nextDate
  while (d > start) d = addDays(d, -step)
  const out: string[] = []
  for (; d <= end; d = addDays(d, step)) if (d >= start) out.push(d)
  return out
}

/** Monto fijo esperado por día del mes (índice 0 = día 1). */
export function fixedSchedule(recurrings: Recurring[], month: string, categoryId?: string): number[] {
  const days = new Array(daysInMonth(month)).fill(0)
  for (const r of recurrings) {
    if (!r.active || r.type !== 'expense') continue
    if (categoryId && r.categoryId !== categoryId) continue
    for (const date of occurrencesInMonth(r, month)) days[Number(date.slice(8, 10)) - 1] += r.amount
  }
  return days
}

/** Gasto esperado acumulado al cierre de cada día. */
export function expectedCurve(budget: number, fixed: number[]): number[] {
  const days = fixed.length
  const fixedTotal = fixed.reduce((s, v) => s + v, 0)
  const variable = Math.max(0, budget - fixedTotal)
  let acc = 0
  return fixed.map((f, i) => {
    acc += f
    return Math.min(budget, acc + (variable * (i + 1)) / days)
  })
}

export type PaceStatus = 'ok' | 'warn' | 'over'

/** Comparado contra lo esperado a la fecha, no contra una línea recta. */
export function paceStatus(spent: number, budget: number, expectedToDate: number): PaceStatus {
  if (spent > budget) return 'over'
  if (spent > expectedToDate + budget * 0.1) return 'warn'
  return 'ok'
}

/** Proyección al cierre: fijos completos + lo variable al ritmo actual. */
export function projectMonth(spent: number, fixed: number[], day: number): number {
  const fixedTotal = fixed.reduce((s, v) => s + v, 0)
  const fixedSoFar = fixed.slice(0, day).reduce((s, v) => s + v, 0)
  const variableSoFar = Math.max(0, spent - fixedSoFar)
  return fixedTotal + (variableSoFar / day) * fixed.length
}

export const prevMonth = (m: string) => addMonths(m, -1)
