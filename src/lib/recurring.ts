import type { Frequency, Recurring } from './types'
import { addDays, parseISO, toISO } from './dates'

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
  yearly: 'Anual',
}

export function advance(iso: string, frequency: Frequency, anchorDay: number): string {
  if (frequency === 'weekly') return addDays(iso, 7)
  if (frequency === 'biweekly') return addDays(iso, 14)
  const d = parseISO(iso)
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

/** Cuánto pesa un recurrente al mes, para el resumen. */
export function monthlyEquivalent(r: Recurring): number {
  switch (r.frequency) {
    case 'weekly':
      return (r.amount * 52) / 12
    case 'biweekly':
      return (r.amount * 26) / 12
    case 'monthly':
      return r.amount
    case 'yearly':
      return r.amount / 12
  }
}
