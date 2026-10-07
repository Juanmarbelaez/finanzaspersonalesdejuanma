import type { Account, Category, Recurring, Transaction } from './types'
import { addDays, addMonths, currentMonth, daysInMonth, todayISO } from './dates'
import { advance } from './recurring'
import { uid } from './id'

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'mercado', name: 'Mercado', emoji: '🛒', color: '#34C77B', kind: 'expense', budget: null },
  { id: 'restaurantes', name: 'Restaurantes', emoji: '🍔', color: '#FF8A3D', kind: 'expense', budget: null },
  { id: 'transporte', name: 'Transporte', emoji: '🚗', color: '#4C8DFF', kind: 'expense', budget: null },
  { id: 'vivienda', name: 'Vivienda', emoji: '🏠', color: '#A07CFF', kind: 'expense', budget: null },
  { id: 'servicios', name: 'Servicios', emoji: '💡', color: '#FFC542', kind: 'expense', budget: null },
  { id: 'suscripciones', name: 'Suscripciones', emoji: '📱', color: '#FF5DA2', kind: 'expense', budget: null },
  { id: 'compras', name: 'Compras', emoji: '🛍️', color: '#2EC5CE', kind: 'expense', budget: null },
  { id: 'salud', name: 'Salud y deporte', emoji: '💪', color: '#22C3A6', kind: 'expense', budget: null },
  { id: 'entretenimiento', name: 'Entretenimiento', emoji: '🎬', color: '#E86CF0', kind: 'expense', budget: null },
  { id: 'viajes', name: 'Viajes', emoji: '✈️', color: '#3DB8FF', kind: 'expense', budget: null },
  { id: 'educacion', name: 'Educación', emoji: '📚', color: '#8D9BFF', kind: 'expense', budget: null },
  { id: 'regalos', name: 'Regalos', emoji: '🎁', color: '#FF7A7A', kind: 'expense', budget: null },
  { id: 'otros', name: 'Otros', emoji: '🧾', color: '#9A9AA2', kind: 'expense', budget: null },
  { id: 'salario', name: 'Salario', emoji: '💼', color: '#34C77B', kind: 'income', budget: null },
  { id: 'negocio', name: 'Negocio', emoji: '💸', color: '#2EC5CE', kind: 'income', budget: null },
  { id: 'inversiones', name: 'Inversiones', emoji: '📈', color: '#A07CFF', kind: 'income', budget: null },
  { id: 'otros-ingresos', name: 'Otros ingresos', emoji: '🪙', color: '#9A9AA2', kind: 'income', budget: null },
]

/** Categorías que no se pueden borrar: reciben los movimientos de las categorías borradas. */
export const FALLBACK_CATEGORY = { expense: 'otros', income: 'otros-ingresos' } as const

export const DEFAULT_ACCOUNTS: Account[] = [
  { id: 'principal', name: 'Cuenta principal', type: 'bank', startingBalance: 0, color: '#2B2B2B' },
  { id: 'nequi', name: 'Nequi', type: 'bank', startingBalance: 0, color: '#376642' },
  { id: 'efectivo', name: 'Efectivo', type: 'cash', startingBalance: 0, color: '#4CA626' },
  { id: 'tarjeta', name: 'Tarjeta de crédito', type: 'credit', startingBalance: 0, color: '#000000' },
]

/** Colores de tarjeta dentro del design system (negro, verdes, grises). */
export const ACCOUNT_COLORS = ['#000000', '#2B2B2B', '#4CA626', '#376642', '#A7C957', '#D8EDDE', '#9A9A9A', '#FFFFFF']

/** Generador pseudoaleatorio con semilla: los datos de ejemplo salen iguales siempre. */
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const DEMO_BUDGETS: Record<string, number> = {
  mercado: 1_400_000,
  restaurantes: 700_000,
  transporte: 600_000,
  vivienda: 2_300_000,
  servicios: 350_000,
  suscripciones: 250_000,
  compras: 500_000,
  salud: 250_000,
  entretenimiento: 200_000,
}

interface Fixed {
  name: string
  amount: number
  day: number
  categoryId: string
  accountId: string
  type: 'expense' | 'income'
}

const FIXED: Fixed[] = [
  { name: 'Salario', amount: 7_800_000, day: 1, categoryId: 'salario', accountId: 'principal', type: 'income' },
  { name: 'Smart Fit', amount: 109_900, day: 2, categoryId: 'salud', accountId: 'tarjeta', type: 'expense' },
  { name: 'iCloud', amount: 11_900, day: 3, categoryId: 'suscripciones', accountId: 'tarjeta', type: 'expense' },
  { name: 'Arriendo', amount: 2_300_000, day: 5, categoryId: 'vivienda', accountId: 'principal', type: 'expense' },
  { name: 'Netflix', amount: 44_900, day: 8, categoryId: 'suscripciones', accountId: 'tarjeta', type: 'expense' },
  { name: 'EPM', amount: 186_000, day: 12, categoryId: 'servicios', accountId: 'principal', type: 'expense' },
  { name: 'Claro Hogar', amount: 109_000, day: 15, categoryId: 'servicios', accountId: 'principal', type: 'expense' },
  { name: 'Spotify', amount: 26_900, day: 20, categoryId: 'suscripciones', accountId: 'tarjeta', type: 'expense' },
]

const VARIABLE: { names: string[]; categoryId: string; min: number; max: number; perWeek: number; accounts: string[] }[] = [
  { names: ['Éxito', 'Carulla', 'D1', 'Ara'], categoryId: 'mercado', min: 60_000, max: 380_000, perWeek: 1.6, accounts: ['tarjeta', 'principal'] },
  { names: ['Rappi', 'Crepes & Waffles', 'Juan Valdez', 'El Corral', 'Wok'], categoryId: 'restaurantes', min: 18_000, max: 140_000, perWeek: 2.6, accounts: ['tarjeta', 'nequi'] },
  { names: ['Uber', 'DiDi', 'Cabify'], categoryId: 'transporte', min: 9_000, max: 38_000, perWeek: 3, accounts: ['tarjeta', 'nequi'] },
  { names: ['Terpel'], categoryId: 'transporte', min: 120_000, max: 190_000, perWeek: 0.45, accounts: ['tarjeta'] },
  { names: ['Amazon', 'Falabella', 'Mercado Libre', 'Zara'], categoryId: 'compras', min: 49_000, max: 420_000, perWeek: 0.7, accounts: ['tarjeta'] },
  { names: ['Cine Colombia', 'Concierto', 'Bolera'], categoryId: 'entretenimiento', min: 25_000, max: 160_000, perWeek: 0.5, accounts: ['tarjeta', 'efectivo'] },
  { names: ['Cruz Verde', 'Farmatodo'], categoryId: 'salud', min: 15_000, max: 90_000, perWeek: 0.35, accounts: ['tarjeta', 'efectivo'] },
  { names: ['Tienda de la esquina', 'Panadería'], categoryId: 'mercado', min: 4_000, max: 22_000, perWeek: 1.2, accounts: ['efectivo', 'nequi'] },
]

export function buildDemo(today = todayISO()) {
  const rand = rng(42)
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]
  const round = (n: number) => Math.round(n / 100) * 100
  const txs: Transaction[] = []
  const recurrings: Recurring[] = FIXED.map((f) => ({
    id: uid(),
    name: f.name,
    amount: f.amount,
    type: f.type,
    categoryId: f.categoryId,
    accountId: f.accountId,
    frequency: 'monthly',
    nextDate: '',
    anchorDay: f.day,
    active: true,
  }))

  const start = addMonths(currentMonth(), -3)
  const startISO = `${start}-01`

  for (let m = 0; m <= 3; m++) {
    const month = addMonths(start, m)
    const dim = daysInMonth(month)

    FIXED.forEach((f, i) => {
      const date = `${month}-${String(Math.min(f.day, dim)).padStart(2, '0')}`
      if (date > today) return
      txs.push({
        id: uid(),
        date,
        type: f.type,
        amount: f.amount,
        name: f.name,
        categoryId: f.categoryId,
        accountId: f.accountId,
        reviewed: true,
        recurringId: recurrings[i].id,
        createdAt: 0,
      })
    })

    // Ingreso extra de vez en cuando
    if (m % 2 === 1) {
      const date = `${month}-18`
      if (date <= today)
        txs.push({ id: uid(), date, type: 'income', amount: 1_250_000, name: 'Proyecto freelance', categoryId: 'negocio', accountId: 'nequi', reviewed: true, createdAt: 0 })
    }

    // Movimientos entre cuentas: recarga a Nequi, retiro de cajero y pago de la tarjeta
    const transfers: [string, number, string, string, number][] = [
      ['02', 650_000, 'nequi', 'Recarga Nequi', 0],
      ['03', 350_000, 'efectivo', 'Retiro cajero', 0],
      ['25', 2_400_000, 'tarjeta', 'Pago tarjeta', 0],
    ]
    for (const [dd, amount, to, name] of transfers) {
      const date = `${month}-${dd}`
      if (date <= today)
        txs.push({ id: uid(), date, type: 'transfer', amount, name, categoryId: null, accountId: 'principal', toAccountId: to, reviewed: true, createdAt: 0 })
    }
  }

  // Gastos variables día a día
  for (let date = startISO; date <= today; date = addDays(date, 1)) {
    for (const v of VARIABLE) {
      if (rand() < v.perWeek / 7) {
        txs.push({
          id: uid(),
          date,
          type: 'expense',
          amount: round(v.min + rand() * (v.max - v.min)),
          name: pick(v.names),
          categoryId: v.categoryId,
          accountId: pick(v.accounts),
          reviewed: true,
          createdAt: 0,
        })
      }
    }
  }

  txs.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1))
  // Los más recientes quedan "por revisar", como si hubieran llegado del banco
  txs.slice(0, 4).forEach((t) => (t.reviewed = false))
  txs.forEach((t, i) => (t.createdAt = txs.length - i))

  for (const r of recurrings) {
    let next = `${start}-${String(r.anchorDay).padStart(2, '0')}`
    while (next <= today) next = advance(next, r.frequency, r.anchorDay)
    r.nextDate = next
  }

  const categories = DEFAULT_CATEGORIES.map((c) => ({ ...c, budget: DEMO_BUDGETS[c.id] ?? null }))
  const accounts = DEFAULT_ACCOUNTS.map((a) => ({
    ...a,
    startingBalance: { principal: 2_400_000, nequi: 420_000, efectivo: 180_000, tarjeta: -650_000 }[a.id] ?? 0,
  }))

  return { transactions: txs, recurrings, categories, accounts }
}
