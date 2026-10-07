import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from './store'
import { FALLBACK_CATEGORY } from './lib/seed'

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
