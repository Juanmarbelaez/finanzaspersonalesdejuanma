import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Account, Category, Recurring, Settings, Transaction } from './lib/types'
import { DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES, FALLBACK_CATEGORY, buildDemo } from './lib/seed'
import { dueOccurrences } from './lib/recurring'
import { normalizeMerchant } from './lib/rules'
import { currentMonth, todayISO } from './lib/dates'
import { uid } from './lib/id'

export type TxInput = Omit<Transaction, 'id' | 'createdAt' | 'reviewed'> & { reviewed?: boolean }

export interface Data {
  onboarded: boolean
  /** Datos de ejemplo cargados: se muestra el banner de modo demo. */
  demo: boolean
  settings: Settings
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  recurrings: Recurring[]
  /** comercio normalizado -> categoría que el usuario eligió */
  merchantRules: Record<string, string>
}

interface Actions {
  start(mode: 'empty' | 'demo'): void
  addTransaction(input: TxInput): void
  updateTransaction(id: string, patch: Partial<TxInput>): void
  deleteTransaction(id: string): void
  setReviewed(ids: string[], reviewed?: boolean): void
  importTransactions(rows: TxInput[]): { added: number; skipped: number }
  upsertCategory(c: Category): void
  deleteCategory(id: string): void
  upsertAccount(a: Account): void
  deleteAccount(id: string): void
  upsertRecurring(r: Recurring): void
  deleteRecurring(id: string): void
  processRecurrings(today?: string): number
  setSettings(patch: Partial<Settings>): void
  restore(data: Data): void
  resetAll(): void
}

// Negro es el fondo principal del design system: arranca en oscuro
const DEFAULT_SETTINGS: Settings = { currency: 'COP', locale: 'es-CO', theme: 'dark', name: '' }

const initialData = (): Data => ({
  onboarded: false,
  demo: false,
  settings: DEFAULT_SETTINGS,
  accounts: DEFAULT_ACCOUNTS,
  categories: DEFAULT_CATEGORIES,
  transactions: [],
  recurrings: [],
  merchantRules: {},
})

function learn(rules: Record<string, string>, t: Pick<Transaction, 'name' | 'categoryId' | 'type'>) {
  const key = normalizeMerchant(t.name)
  if (!key || !t.categoryId || t.type === 'transfer' || rules[key] === t.categoryId) return rules
  return { ...rules, [key]: t.categoryId }
}

const dedupeKey = (t: Pick<Transaction, 'date' | 'amount' | 'type' | 'name' | 'accountId'>) =>
  `${t.date}|${t.amount}|${t.type}|${normalizeMerchant(t.name)}|${t.accountId}`

export const useStore = create<Data & Actions>()(
  persist(
    (set, get) => ({
      ...initialData(),

      start(mode) {
        if (mode === 'demo') {
          set({ ...buildDemo(), onboarded: true, demo: true })
        } else {
          set({ onboarded: true, demo: false })
        }
      },

      addTransaction(input) {
        const tx: Transaction = { reviewed: true, ...input, id: uid(), createdAt: Date.now() }
        set((s) => ({ transactions: [tx, ...s.transactions], merchantRules: learn(s.merchantRules, tx) }))
      },

      updateTransaction(id, patch) {
        set((s) => {
          let rules = s.merchantRules
          const transactions = s.transactions.map((t) => {
            if (t.id !== id) return t
            const next = { ...t, ...patch }
            if (next.type !== 'transfer') delete next.toAccountId
            rules = learn(rules, next)
            return next
          })
          return { transactions, merchantRules: rules }
        })
      },

      deleteTransaction(id) {
        set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }))
      },

      setReviewed(ids, reviewed = true) {
        const set_ = new Set(ids)
        set((s) => ({ transactions: s.transactions.map((t) => (set_.has(t.id) ? { ...t, reviewed } : t)) }))
      },

      importTransactions(rows) {
        // Si el mismo extracto se importa dos veces, no duplicar.
        // Se cuentan repeticiones para no perder dos compras iguales el mismo día.
        const existing = new Map<string, number>()
        for (const t of get().transactions) {
          const k = dedupeKey(t)
          existing.set(k, (existing.get(k) ?? 0) + 1)
        }
        const now = Date.now()
        const added: Transaction[] = []
        let skipped = 0
        rows.forEach((r, i) => {
          const k = dedupeKey(r)
          const left = existing.get(k) ?? 0
          if (left > 0) {
            existing.set(k, left - 1)
            skipped++
            return
          }
          added.push({ reviewed: false, ...r, id: uid(), createdAt: now - i })
        })
        set((s) => ({ transactions: [...added, ...s.transactions] }))
        return { added: added.length, skipped }
      },

      upsertCategory(c) {
        set((s) => {
          const exists = s.categories.some((x) => x.id === c.id)
          return { categories: exists ? s.categories.map((x) => (x.id === c.id ? c : x)) : [...s.categories, c] }
        })
      },

      deleteCategory(id) {
        const cat = get().categories.find((c) => c.id === id)
        if (!cat || id === FALLBACK_CATEGORY.expense || id === FALLBACK_CATEGORY.income) return
        const fallback = FALLBACK_CATEGORY[cat.kind]
        set((s) => ({
          categories: s.categories.filter((c) => c.id !== id),
          transactions: s.transactions.map((t) => (t.categoryId === id ? { ...t, categoryId: fallback } : t)),
          recurrings: s.recurrings.map((r) => (r.categoryId === id ? { ...r, categoryId: fallback } : r)),
          merchantRules: Object.fromEntries(Object.entries(s.merchantRules).filter(([, v]) => v !== id)),
        }))
      },

      upsertAccount(a) {
        set((s) => {
          const exists = s.accounts.some((x) => x.id === a.id)
          return { accounts: exists ? s.accounts.map((x) => (x.id === a.id ? a : x)) : [...s.accounts, a] }
        })
      },

      deleteAccount(id) {
        set((s) => ({
          accounts: s.accounts.filter((a) => a.id !== id),
          transactions: s.transactions.filter((t) => t.accountId !== id && t.toAccountId !== id),
          recurrings: s.recurrings.filter((r) => r.accountId !== id),
        }))
      },

      upsertRecurring(r) {
        set((s) => {
          const exists = s.recurrings.some((x) => x.id === r.id)
          return { recurrings: exists ? s.recurrings.map((x) => (x.id === r.id ? r : x)) : [...s.recurrings, r] }
        })
        get().processRecurrings()
      },

      deleteRecurring(id) {
        set((s) => ({ recurrings: s.recurrings.filter((r) => r.id !== id) }))
      },

      processRecurrings(today = todayISO()) {
        const { recurrings } = get()
        const created: Transaction[] = []
        const now = Date.now()
        const updated = recurrings.map((r) => {
          if (!r.active) return r
          const { dates, next } = dueOccurrences(r, today)
          if (!dates.length) return r
          for (const date of dates) {
            created.push({
              id: uid(),
              date,
              type: r.type,
              amount: r.amount,
              name: r.name,
              categoryId: r.categoryId,
              accountId: r.accountId,
              // Queda por revisar: confirmas que sí se cobró y el valor real
              reviewed: false,
              recurringId: r.id,
              createdAt: now,
            })
          }
          return { ...r, nextDate: next }
        })
        if (created.length) set((s) => ({ recurrings: updated, transactions: [...created, ...s.transactions] }))
        return created.length
      },

      setSettings(patch) {
        set((s) => ({ settings: { ...s.settings, ...patch } }))
      },

      restore(data) {
        set({ ...initialData(), ...data, onboarded: true, demo: false })
      },

      resetAll() {
        set(initialData())
      },
    }),
    {
      name: 'plata',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s): Data => ({
        onboarded: s.onboarded,
        demo: s.demo,
        settings: s.settings,
        accounts: s.accounts,
        categories: s.categories,
        transactions: s.transactions,
        recurrings: s.recurrings,
        merchantRules: s.merchantRules,
      }),
    },
  ),
)

/* ---------- Estado de la interfaz (no se guarda) ---------- */

export type Tab = 'dashboard' | 'transactions' | 'categories' | 'recurrings' | 'cashflow' | 'accounts'

export const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Resumen' },
  { id: 'transactions', label: 'Movimientos' },
  { id: 'categories', label: 'Categorías' },
  { id: 'recurrings', label: 'Recurrentes' },
  { id: 'cashflow', label: 'Flujo de caja' },
  { id: 'accounts', label: 'Cuentas' },
]

export type Sheet =
  | { name: 'tx'; id?: string; preset?: Partial<TxInput> }
  | { name: 'category'; id: string }
  | { name: 'categoryEdit'; id?: string; kind?: 'expense' | 'income' }
  | { name: 'categoriesManage' }
  | { name: 'recurring'; id: string }
  | { name: 'recurringEdit'; id?: string; fromTx?: string }
  | { name: 'account'; id: string }
  | { name: 'accountEdit'; id?: string; type?: Account['type'] }
  | { name: 'filters' }
  | { name: 'month' }
  | { name: 'settings' }
  | { name: 'import' }

export interface TxFilters {
  type: 'all' | 'expense' | 'income' | 'transfer'
  review: boolean
  categoryId: string | null
  accountId: string | null
}

export const NO_FILTERS: TxFilters = { type: 'all', review: false, categoryId: null, accountId: null }

interface UI {
  tab: Tab
  sheets: Sheet[]
  month: string
  filters: TxFilters
  setTab(tab: Tab): void
  openSheet(s: Sheet): void
  /** Cierra la hoja de arriba. */
  closeSheet(): void
  closeAll(): void
  setMonth(m: string): void
  setFilters(f: Partial<TxFilters>): void
}

export const useUI = create<UI>()((set) => ({
  tab: 'dashboard',
  sheets: [],
  month: currentMonth(),
  filters: NO_FILTERS,
  setTab: (tab) => set({ tab }),
  openSheet: (sheet) => set((s) => ({ sheets: [...s.sheets, sheet] })),
  closeSheet: () => set((s) => ({ sheets: s.sheets.slice(0, -1) })),
  closeAll: () => set({ sheets: [] }),
  setMonth: (month) => set({ month }),
  setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),
}))
