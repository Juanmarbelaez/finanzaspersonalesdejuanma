import type { Account, Category, Recurring, Settings, Transaction } from './types'
import { clampISO, isISODate } from './recurring'

/*
 * Limpia datos que vienen de afuera (localStorage viejo, un respaldo, la nube).
 * Lo que está dañado se descarta pieza por pieza; nunca se cae la app entera por una fila mala.
 */

export interface CleanData {
  onboarded: boolean
  demo: boolean
  settings: Settings
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  recurrings: Recurring[]
  merchantRules: Record<string, string>
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback)
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const date = (v: unknown) => {
  const d = typeof v === 'string' ? clampISO(v) : ''
  return isISODate(d) ? d : null
}

function list<T>(v: unknown, clean: (o: Obj) => T | null): T[] {
  if (!Array.isArray(v)) return []
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of v) {
    if (!isObj(item) || typeof item.id !== 'string' || !item.id || seen.has(item.id)) continue
    const c = clean(item)
    if (c) {
      seen.add(item.id)
      out.push(c)
    }
  }
  return out
}

const TX_TYPES = ['expense', 'income', 'transfer']
const ACCOUNT_TYPES = ['bank', 'cash', 'credit', 'savings', 'investment']
const FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'yearly']

export function cleanTransaction(o: Obj): Transaction | null {
  const d = date(o.date)
  const amount = num(o.amount)
  if (!d || amount === null || !TX_TYPES.includes(o.type as string) || typeof o.accountId !== 'string') return null
  const t: Transaction = {
    id: o.id as string,
    date: d,
    type: o.type as Transaction['type'],
    amount: Math.abs(amount),
    name: str(o.name),
    categoryId: typeof o.categoryId === 'string' ? o.categoryId : null,
    accountId: o.accountId,
    reviewed: o.reviewed !== false,
    createdAt: num(o.createdAt) ?? 0,
  }
  if (t.type === 'transfer' && typeof o.toAccountId === 'string') t.toAccountId = o.toAccountId
  if (typeof o.note === 'string' && o.note) t.note = o.note
  if (typeof o.recurringId === 'string') t.recurringId = o.recurringId
  if (typeof o.importKey === 'string') t.importKey = o.importKey
  return t
}

export function cleanRecurring(o: Obj): Recurring | null {
  const nextDate = date(o.nextDate)
  const amount = num(o.amount)
  if (!nextDate || amount === null || !FREQUENCIES.includes(o.frequency as string)) return null
  const anchor = num(o.anchorDay) ?? Number(nextDate.slice(8, 10))
  return {
    id: o.id as string,
    name: str(o.name),
    amount: Math.abs(amount),
    type: o.type === 'income' ? 'income' : 'expense',
    categoryId: str(o.categoryId),
    accountId: str(o.accountId),
    frequency: o.frequency as Recurring['frequency'],
    nextDate,
    anchorDay: Math.min(31, Math.max(1, Math.round(anchor))),
    active: o.active !== false,
  }
}

function cleanAccount(o: Obj): Account | null {
  return {
    id: o.id as string,
    name: str(o.name, 'Cuenta'),
    type: ACCOUNT_TYPES.includes(o.type as string) ? (o.type as Account['type']) : 'bank',
    startingBalance: num(o.startingBalance) ?? 0,
    color: str(o.color, '#4CA626'),
  }
}

function cleanCategory(o: Obj): Category | null {
  const budget = num(o.budget)
  return {
    id: o.id as string,
    name: str(o.name, 'Categoría'),
    emoji: str(o.emoji),
    color: str(o.color, '#4CA626'),
    kind: o.kind === 'income' ? 'income' : 'expense',
    budget: budget && budget > 0 ? budget : null,
  }
}

/** `base` llena lo que falte (cuentas y categorías por defecto, ajustes). */
export function sanitizeData(raw: unknown, base: CleanData): CleanData {
  const o = isObj(raw) ? raw : {}
  const accounts = list(o.accounts, cleanAccount)
  const categories = list(o.categories, cleanCategory)
  const s = isObj(o.settings) ? o.settings : {}
  const rules = isObj(o.merchantRules)
    ? Object.fromEntries(Object.entries(o.merchantRules).filter((e): e is [string, string] => typeof e[1] === 'string'))
    : {}
  return {
    onboarded: o.onboarded === true,
    demo: o.demo === true,
    settings: {
      ...base.settings,
      ...(typeof s.currency === 'string' && { currency: s.currency }),
      ...(typeof s.locale === 'string' && { locale: s.locale }),
      ...(['system', 'dark', 'light'].includes(s.theme as string) && { theme: s.theme as Settings['theme'] }),
      ...(typeof s.name === 'string' && { name: s.name }),
      ...(num(s.lastBackup) !== null && { lastBackup: s.lastBackup as number }),
    },
    accounts: accounts.length ? accounts : base.accounts,
    categories: categories.length ? categories : base.categories,
    transactions: list(o.transactions, cleanTransaction),
    recurrings: list(o.recurrings, cleanRecurring),
    merchantRules: rules,
  }
}
