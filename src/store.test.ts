import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from './store'
import { FALLBACK_CATEGORY } from './lib/seed'
import { accountBalances } from './lib/selectors'

const s = () => useStore.getState()

beforeEach(() => {
  s().resetAll()
  s().start('demo')
})

describe('borrar con deshacer', () => {
  it('categoría: vuelve a su lugar y recupera solo sus movimientos', () => {
    const cat = s().categories.find(
      (c) => c.kind === 'expense' && c.id !== FALLBACK_CATEGORY.expense && s().transactions.some((t) => t.categoryId === c.id),
    )!
    const index = s().categories.indexOf(cat)
    const mine = s()
      .transactions.filter((t) => t.categoryId === cat.id)
      .map((t) => t.id)
    const alreadyOther = s()
      .transactions.filter((t) => t.categoryId === FALLBACK_CATEGORY.expense)
      .map((t) => t.id)

    const undo = s().deleteCategory(cat.id)
    expect(s().categories.some((c) => c.id === cat.id)).toBe(false)
    expect(
      s()
        .transactions.filter((t) => mine.includes(t.id))
        .every((t) => t.categoryId === FALLBACK_CATEGORY.expense),
    ).toBe(true)

    undo()
    expect(s().categories[index].id).toBe(cat.id)
    expect(
      s()
        .transactions.filter((t) => mine.includes(t.id))
        .every((t) => t.categoryId === cat.id),
    ).toBe(true)
    // Lo que ya estaba en Otros se queda en Otros
    expect(
      s()
        .transactions.filter((t) => alreadyOther.includes(t.id))
        .every((t) => t.categoryId === FALLBACK_CATEGORY.expense),
    ).toBe(true)
  })

  it('cuenta: devuelve la cuenta, sus movimientos y sus recurrentes', () => {
    const acc = s().accounts.find((a) => s().transactions.some((t) => t.accountId === a.id))!
    const txCount = s().transactions.length
    const recCount = s().recurrings.length

    const undo = s().deleteAccount(acc.id)
    expect(s().transactions.length).toBeLessThan(txCount)

    undo()
    expect(s().accounts.some((a) => a.id === acc.id)).toBe(true)
    expect(s().transactions.length).toBe(txCount)
    expect(s().recurrings.length).toBe(recCount)
  })

  it('recurrente: deshacer dos veces no lo duplica', () => {
    const r = s().recurrings[0]
    const undo = s().deleteRecurring(r.id)
    undo()
    undo()
    expect(s().recurrings.filter((x) => x.id === r.id)).toHaveLength(1)
  })

  it('borrar algo que no existe no rompe', () => {
    expect(() => s().deleteAccount('nope')()).not.toThrow()
    expect(() => s().deleteCategory(FALLBACK_CATEGORY.expense)()).not.toThrow()
  })
})

describe('recurrentes', () => {
  const base = () => ({
    id: 'gym',
    name: 'Gym',
    amount: 100,
    type: 'expense' as const,
    categoryId: s().categories[0].id,
    accountId: s().accounts[0].id,
    frequency: 'monthly' as const,
    anchorDay: 1,
  })
  const charges = () => s().transactions.filter((t) => t.recurringId === 'gym').length

  it('reanudar uno pausado no inventa los cobros de la pausa', () => {
    s().upsertRecurring({ ...base(), nextDate: '2020-01-01', active: false })
    expect(charges()).toBe(0)
    s().upsertRecurring({ ...s().recurrings.find((r) => r.id === 'gym')!, active: true })
    expect(charges()).toBeLessThanOrEqual(1)
    expect(s().recurrings.find((r) => r.id === 'gym')!.nextDate > '2020-01-01').toBe(true)
  })

  it('"solo desde hoy" no registra lo de atrás; por defecto sí', () => {
    s().upsertRecurring({ ...base(), nextDate: '2020-01-01', active: true }, { fromToday: true })
    expect(charges()).toBeLessThanOrEqual(1)
    s().upsertRecurring({ ...base(), id: 'gym2', nextDate: '2026-01-01', active: true })
    expect(s().transactions.filter((t) => t.recurringId === 'gym2').length).toBeGreaterThan(1)
  })

  it('una fecha imposible se guarda como el último día del mes', () => {
    s().upsertRecurring({ ...base(), nextDate: '2099-04-31', anchorDay: 31, active: true })
    expect(s().recurrings.find((r) => r.id === 'gym')!.nextDate).toBe('2099-04-30')
  })
})

describe('restaurar', () => {
  it('limpia el respaldo antes de usarlo', () => {
    s().restore({ transactions: [{ id: 'x', date: 'mal' }], accounts: 'nada' } as never)
    expect(s().transactions).toEqual([])
    expect(s().accounts.length).toBeGreaterThan(0)
    expect(s().onboarded).toBe(true)
  })
})

describe('importar y saldo de hoy', () => {
  it('con "dejar el saldo de hoy" el saldo no se mueve', () => {
    const acct = s().accounts[0].id
    const before = accountBalances(s().accounts, s().transactions).get(acct)
    s().importTransactions(
      [{ date: '2020-01-05', type: 'expense', amount: 12345, name: 'Algo viejo', categoryId: null, accountId: acct }],
      {
        keepBalance: true,
      },
    )
    expect(accountBalances(s().accounts, s().transactions).get(acct)).toBe(before)
  })

  it('sin la opción, el saldo cambia con lo importado', () => {
    const acct = s().accounts[0].id
    const before = accountBalances(s().accounts, s().transactions).get(acct)!
    s().importTransactions([{ date: '2020-01-05', type: 'expense', amount: 12345, name: 'Algo viejo', categoryId: null, accountId: acct }])
    expect(accountBalances(s().accounts, s().transactions).get(acct)).toBe(before - 12345)
  })
})
