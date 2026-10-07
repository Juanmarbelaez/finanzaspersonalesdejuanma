import { describe, expect, it } from 'vitest'
import { detectDateFormat, parseAmount, parseCSV, parseDate } from './csv'
import { advance, dueOccurrences } from './recurring'
import { suggestCategory } from './rules'
import { accountBalances, budgetStatus, cumulativeDaily, groupByDay, totals } from './selectors'
import { formatMoney } from './format'
import type { Recurring, Transaction } from './types'

const tx = (p: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(),
  date: '2026-10-01',
  type: 'expense',
  amount: 0,
  name: '',
  categoryId: 'otros',
  accountId: 'a',
  reviewed: true,
  createdAt: 0,
  ...p,
})

describe('parseAmount', () => {
  it.each([
    ['45.000', 45000],
    ['1.234.567', 1234567],
    ['1.234.567,89', 1234567.89],
    ['1,234,567.89', 1234567.89],
    ['$ -45.000', -45000],
    ['(12.500)', -12500],
    ['45000', 45000],
    ['45.5', 45.5],
    ['12,99', 12.99],
    ['-1,250.00', -1250],
    ['', null],
    ['abc', null],
  ])('%s -> %s', (raw, expected) => {
    expect(parseAmount(raw)).toBe(expected)
  })
})

describe('parseCSV', () => {
  it('detecta punto y coma y respeta comillas', () => {
    const rows = parseCSV('Fecha;Descripción;Valor\n05/10/2026;"RAPPI; COLOMBIA";-45.000\n\n06/10/2026;Nómina;7.800.000\n')
    expect(rows).toEqual([
      ['Fecha', 'Descripción', 'Valor'],
      ['05/10/2026', 'RAPPI; COLOMBIA', '-45.000'],
      ['06/10/2026', 'Nómina', '7.800.000'],
    ])
  })

  it('maneja comillas escapadas y CRLF', () => {
    expect(parseCSV('a,b\r\n"di ""hola""",2\r\n')).toEqual([
      ['a', 'b'],
      ['di "hola"', '2'],
    ])
  })
})

describe('fechas de extractos', () => {
  it('detecta formato', () => {
    expect(detectDateFormat(['2026-10-05'])).toBe('ymd')
    expect(detectDateFormat(['05/10/2026', '25/10/2026'])).toBe('dmy')
    expect(detectDateFormat(['10/25/2026'])).toBe('mdy')
  })

  it('parsea y valida', () => {
    expect(parseDate('05/10/2026', 'dmy')).toBe('2026-10-05')
    expect(parseDate('5-1-26', 'dmy')).toBe('2026-01-05')
    expect(parseDate('31/02/2026', 'dmy')).toBeNull()
    expect(parseDate('2026/10/05 10:32', 'ymd')).toBe('2026-10-05')
  })
})

describe('recurrentes', () => {
  it('mensual conserva el día aunque pase por febrero', () => {
    expect(advance('2026-01-31', 'monthly', 31)).toBe('2026-02-28')
    expect(advance('2026-02-28', 'monthly', 31)).toBe('2026-03-31')
    expect(advance('2026-12-15', 'monthly', 15)).toBe('2027-01-15')
    expect(advance('2026-10-01', 'biweekly', 1)).toBe('2026-10-15')
    expect(advance('2024-02-29', 'yearly', 29)).toBe('2025-02-28')
  })

  it('genera las fechas vencidas', () => {
    const r: Recurring = {
      id: 'r',
      name: 'Netflix',
      amount: 44900,
      type: 'expense',
      categoryId: 'suscripciones',
      accountId: 'a',
      frequency: 'monthly',
      nextDate: '2026-08-08',
      anchorDay: 8,
      active: true,
    }
    expect(dueOccurrences(r, '2026-10-07')).toEqual({ dates: ['2026-08-08', '2026-09-08'], next: '2026-10-08' })
    expect(dueOccurrences(r, '2026-08-07').dates).toEqual([])
  })
})

describe('auto-categorías', () => {
  const ids = new Set(['mercado', 'restaurantes', 'transporte', 'suscripciones', 'gym'])

  it('usa palabras clave colombianas', () => {
    expect(suggestCategory('COMPRA EXITO POBLADO', {}, ids)).toBe('mercado')
    expect(suggestCategory('Uber *Trip', {}, ids)).toBe('transporte')
    expect(suggestCategory('NETFLIX.COM', {}, ids)).toBe('suscripciones')
    expect(suggestCategory('Paramo', {}, ids)).toBeNull()
  })

  it('las reglas aprendidas ganan a las palabras clave', () => {
    expect(suggestCategory('Uber', { uber: 'restaurantes' }, ids)).toBe('restaurantes')
    expect(suggestCategory('PAGO SMART FIT MEDELLIN', { 'smart fit': 'gym' }, ids)).toBe('gym')
  })

  it('ignora reglas que apuntan a categorías borradas', () => {
    expect(suggestCategory('Uber', { uber: 'borrada' }, ids)).toBe('transporte')
  })
})

describe('cálculos', () => {
  const txs = [
    tx({ date: '2026-10-01', type: 'income', amount: 1000 }),
    tx({ date: '2026-10-01', amount: 100 }),
    tx({ date: '2026-10-03', amount: 50 }),
    tx({ date: '2026-10-03', type: 'transfer', amount: 500, toAccountId: 'b' }),
  ]

  it('totales ignoran transferencias', () => {
    expect(totals(txs)).toEqual({ income: 1000, expense: 150, net: 850, savingsRate: 0.85 })
  })

  it('gasto acumulado diario', () => {
    const c = cumulativeDaily(txs, '2026-10')
    expect(c.length).toBe(31)
    expect(c.slice(0, 4)).toEqual([100, 100, 150, 150])
    expect(c[30]).toBe(150)
  })

  it('saldos de cuentas con transferencias', () => {
    const b = accountBalances(
      [
        { id: 'a', name: 'A', type: 'bank', startingBalance: 200, color: '' },
        { id: 'b', name: 'B', type: 'credit', startingBalance: -300, color: '' },
      ],
      txs,
    )
    expect(b.get('a')).toBe(200 + 1000 - 150 - 500)
    expect(b.get('b')).toBe(200)
  })

  it('agrupa por día', () => {
    const g = groupByDay(txs)
    expect(g.map((d) => d.date)).toEqual(['2026-10-03', '2026-10-01'])
    expect(g[1].net).toBe(900)
  })

  it('estado del presupuesto según el ritmo del mes', () => {
    expect(budgetStatus(1200, 1000, 20, 30)).toBe('over')
    expect(budgetStatus(600, 1000, 5, 30)).toBe('warn')
    expect(budgetStatus(600, 1000, 20, 30)).toBe('ok')
    expect(budgetStatus(900, 1000, 29, 30)).toBe('ok')
  })
})

describe('formatMoney', () => {
  it('pesos colombianos', () => {
    expect(formatMoney(1234567, 'es-CO', 'COP')).toBe('$1.234.567')
    expect(formatMoney(-45000, 'es-CO', 'COP')).toBe('−$45.000')
    expect(formatMoney(45000, 'es-CO', 'COP', { sign: true })).toBe('+$45.000')
  })
})
