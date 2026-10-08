import type { Transaction, TxType } from './types'
import { normalizeMerchant } from './rules'
import { daysBetween } from './dates'

/*
 * Qué filas de un extracto ya están en la app.
 * 1. La misma fila de un extracto anterior: se reconoce por su huella original (importKey),
 *    que no cambia aunque después le edites el nombre, la fecha o la categoría.
 * 2. Algo que anotaste a mano o que registró un recurrente: misma cuenta, mismo tipo,
 *    mismo valor y hasta 3 días de diferencia (el banco a veces lo asienta después).
 */

type Row = { date: string; amount: number; type: TxType; name: string; accountId: string }

const NEAR_DAYS = 3

/** Huella de una fila del extracto. Se numeran las repetidas para no perder dos compras iguales el mismo día. */
export function importKeys(rows: Row[]): string[] {
  const seen = new Map<string, number>()
  return rows.map((r) => {
    const base = `${r.accountId}|${r.date}|${r.type}|${r.amount}|${normalizeMerchant(r.name)}`
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    return `${base}#${n}`
  })
}

/** Para movimientos importados antes de que existiera importKey. */
const legacyKey = (t: Row) => `${t.date}|${t.amount}|${t.type}|${normalizeMerchant(t.name)}|${t.accountId}`

export function matchImport(existing: Transaction[], rows: Row[]): { keys: string[]; isNew: boolean[] } {
  const keys = importKeys(rows)
  const have = new Set(existing.flatMap((t) => (t.importKey ? [t.importKey] : [])))
  const legacy = new Map<string, number>()
  for (const t of existing) if (!t.importKey) legacy.set(legacyKey(t), (legacy.get(legacyKey(t)) ?? 0) + 1)
  // Candidatos a "ya lo anotaste": lo que no vino de un extracto
  const loose = existing.filter((t) => !t.importKey)
  const used = new Set<string>()

  const isNew = rows.map((r, i) => {
    if (have.has(keys[i])) return false
    const lk = legacyKey(r)
    const left = legacy.get(lk) ?? 0
    if (left > 0) {
      legacy.set(lk, left - 1)
      return false
    }
    const twin = loose.find(
      (t) =>
        !used.has(t.id) &&
        t.amount === r.amount &&
        // El pago de la tarjeta que ya entró desde la cuenta del banco también cuenta
        ((t.accountId === r.accountId && (t.type === r.type || t.type === 'transfer' || r.type === 'transfer')) ||
          (t.type === 'transfer' && t.toAccountId === r.accountId)) &&
        Math.abs(daysBetween(t.date, r.date)) <= NEAR_DAYS,
    )
    if (twin) {
      used.add(twin.id)
      return false
    }
    return true
  })
  return { keys, isNew }
}

/*
 * Pagos a la tarjeta y traslados entre tus cuentas: no son gasto.
 * Las compras ya se cuentan en la tarjeta; contarlas otra vez al pagarla las duplica.
 */
const OWN_TRANSFER =
  /\b(pago|abono)\s+(a\s+|de\s+)?(la\s+)?(tarjeta|tc|t\.c\.?|tdc|tj|visa|master\s?card|amex)\b|\bpago\s+(tarjeta|tc)\b|\btraslado\s+(entre|a)\s+(mis\s+)?(cuentas|cuenta\s+propia|ahorros)\b|\btransferencia\s+entre\s+(mis\s+)?cuentas\b|\b(a|desde)\s+bolsillo\b/i

export function isOwnTransfer(name: string): boolean {
  return OWN_TRANSFER.test(name.normalize('NFD').replace(/[̀-ͯ]/g, ''))
}
