export type TxType = 'expense' | 'income' | 'transfer'

export type AccountType = 'bank' | 'cash' | 'credit' | 'savings' | 'investment'

export interface Account {
  id: string
  name: string
  type: AccountType
  /** Saldo con el que arrancó la cuenta en la app. En tarjetas de crédito, la deuda va en negativo. */
  startingBalance: number
  color: string
}

export interface Category {
  id: string
  name: string
  emoji: string
  color: string
  kind: 'expense' | 'income'
  /** Presupuesto mensual. null = sin presupuesto. */
  budget: number | null
}

export interface Transaction {
  id: string
  /** YYYY-MM-DD */
  date: string
  type: TxType
  /** Siempre positivo; el tipo define el signo. */
  amount: number
  name: string
  categoryId: string | null
  accountId: string
  /** Solo para transferencias. */
  toAccountId?: string
  note?: string
  reviewed: boolean
  recurringId?: string
  createdAt: number
}

export type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'yearly'

export interface Recurring {
  id: string
  name: string
  amount: number
  type: 'expense' | 'income'
  categoryId: string
  accountId: string
  frequency: Frequency
  /** YYYY-MM-DD del próximo cobro. */
  nextDate: string
  /** Día del mes original, para no perderlo al pasar por meses cortos. */
  anchorDay: number
  active: boolean
}

export type Theme = 'system' | 'dark' | 'light'

export interface Settings {
  currency: string
  locale: string
  theme: Theme
  name: string
  /** Última vez que se exportó un respaldo (ms). */
  lastBackup?: number
}
