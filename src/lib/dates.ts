const pad = (n: number) => String(n).padStart(2, '0')

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayISO(): string {
  return toISO(new Date())
}

/** Fecha local a medianoche (sin líos de zona horaria). */
export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

export function currentMonth(): string {
  return monthKey(todayISO())
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseISO(to).getTime() - parseISO(from).getTime()) / 86_400_000)
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function monthLabel(month: string, locale: string, withYear = true): string {
  const d = parseISO(`${month}-01`)
  const sameYear = month.slice(0, 4) === currentMonth().slice(0, 4)
  return cap(d.toLocaleDateString(locale, withYear && !sameYear ? { month: 'long', year: 'numeric' } : { month: 'long' }))
}

export function shortMonthLabel(month: string, locale: string): string {
  const d = parseISO(`${month}-01`)
  return cap(d.toLocaleDateString(locale, { month: 'short' }).replace('.', ''))
}

export function dayLabel(iso: string, locale: string, today = todayISO()): string {
  const diff = daysBetween(iso, today)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  const d = parseISO(iso)
  const opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }
  if (iso.slice(0, 4) !== today.slice(0, 4)) opts.year = 'numeric'
  return cap(d.toLocaleDateString(locale, opts).replace(',', ''))
}

export function shortDate(iso: string, locale: string): string {
  return parseISO(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' }).replace('.', '')
}

export function relativeDue(iso: string, today = todayISO()): string {
  const diff = daysBetween(today, iso)
  if (diff < 0) return diff === -1 ? 'Ayer' : `Hace ${-diff} días`
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Mañana'
  return `En ${diff} días`
}
