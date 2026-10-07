import type { Frequency, Recurring } from './types'
import { addDays, parseISO, toISO } from './dates'

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
  yearly: 'Anual',
}

const lastDay = (y: number, m: number) => new Date(y, m + 1, 0).getDate()

/** Fecha válida de verdad (no 2026-02-31, que el navegador convierte en marzo). */
export function isISODate(s: unknown): boolean {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  return m >= 1 && m <= 12 && d >= 1 && d <= lastDay(y, m - 1)
}

/** Si el día no existe en ese mes (31 de abril), queda en el último día. */
export function clampISO(s: string): string {
  if (isISODate(s) || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const [y, m] = s.split('-').map(Number)
  return `${s.slice(0, 8)}${String(lastDay(y, m - 1)).padStart(2, '0')}`
}

export function advance(iso: string, frequency: Frequency, anchorDay: number): string {
  if (frequency === 'weekly') return addDays(iso, 7)
  const d = parseISO(iso)
  if (frequency === 'biweekly') {
    // Quincena de verdad: dos fechas fijas al mes (el 15 y el 30, o el 1 y el 16), no cada 14 días
    const first = anchorDay > 15 ? anchorDay - 15 : anchorDay
    const second = first + 15
    const y = d.getFullYear()
    const m = d.getMonth()
    if (d.getDate() < Math.min(second, lastDay(y, m)) && d.getDate() >= first) return toISO(new Date(y, m, Math.min(second, lastDay(y, m))))
    const nm = d.getDate() < first ? m : m + 1
    return toISO(new Date(y, nm, Math.min(first, lastDay(y, nm))))
  }
  const months = frequency === 'monthly' ? 1 : 12
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1)
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(anchorDay, last))
  return toISO(target)
}

/** Fechas que ya se cumplieron (<= hoy) y la próxima fecha pendiente. */
export function dueOccurrences(r: Recurring, today: string, max = 60): { dates: string[]; next: string } {
  const dates: string[] = []
  let next = r.nextDate
  while (next <= today && dates.length < max) {
    dates.push(next)
    next = advance(next, r.frequency, r.anchorDay)
  }
  return { dates, next }
}

/** Primera fecha desde hoy, sin registrar las que ya pasaron (al reanudar o al elegir "solo desde hoy"). */
export function skipPast(r: Recurring, today: string): string {
  let next = r.nextDate
  for (let i = 0; next < today && i < 2000; i++) next = advance(next, r.frequency, r.anchorDay)
  return next
}

/** Cuánto pesa un recurrente al mes, para el resumen. */
export function monthlyEquivalent(r: Recurring): number {
  switch (r.frequency) {
    case 'weekly':
      return (r.amount * 52) / 12
    case 'biweekly':
      return r.amount * 2
    case 'monthly':
      return r.amount
    case 'yearly':
      return r.amount / 12
  }
}
