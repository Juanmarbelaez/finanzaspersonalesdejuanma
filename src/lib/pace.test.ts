import { describe, expect, it } from 'vitest'
import { expectedCurve, fixedSchedule, occurrencesInMonth, paceStatus, projectMonth } from './pace'
import type { Recurring } from './types'

const rec = (p: Partial<Recurring>): Recurring => ({
  id: 'r',
  name: 'Arriendo',
  amount: 2_000_000,
  type: 'expense',
  categoryId: 'vivienda',
  accountId: 'a',
  frequency: 'monthly',
  nextDate: '2026-11-05',
  anchorDay: 5,
  active: true,
  ...p,
})

describe('ritmo con pagos fijos', () => {
  it('ubica los recurrentes en su día', () => {
    expect(occurrencesInMonth(rec({}), '2026-10')).toEqual(['2026-10-05'])
    expect(occurrencesInMonth(rec({ anchorDay: 31 }), '2026-02')).toEqual(['2026-02-28'])
    expect(occurrencesInMonth(rec({ frequency: 'weekly', nextDate: '2026-10-09' }), '2026-10')).toEqual([
      '2026-10-02',
      '2026-10-09',
      '2026-10-16',
      '2026-10-23',
      '2026-10-30',
    ])
    expect(occurrencesInMonth(rec({ frequency: 'yearly', nextDate: '2027-03-10', anchorDay: 10 }), '2026-10')).toEqual([])
  })

  it('el arriendo pagado el día 5 no cuenta como ir rápido', () => {
    const fixed = fixedSchedule([rec({})], '2026-10')
    const curve = expectedCurve(3_100_000, fixed)
    // día 7: arriendo completo + 7/31 del variable (1.1M)
    expect(Math.round(curve[6])).toBe(Math.round(2_000_000 + (1_100_000 * 7) / 31))
    expect(paceStatus(2_200_000, 3_100_000, curve[6])).toBe('ok')
    // sin contar fijos, este mismo gasto se vería muy adelantado
    expect(paceStatus(2_200_000, 3_100_000, (3_100_000 * 7) / 31)).toBe('warn')
  })

  it('proyecta el cierre con fijos completos y variable al ritmo', () => {
    const fixed = fixedSchedule([rec({})], '2026-10')
    // día 10: gastó arriendo + 310k variables -> 31k/día -> 961k al mes
    expect(Math.round(projectMonth(2_310_000, fixed, 10))).toBe(2_000_000 + 961_000)
  })

  it('ignora pausados e ingresos', () => {
    expect(fixedSchedule([rec({ active: false }), rec({ type: 'income' })], '2026-10').every((v) => v === 0)).toBe(true)
  })
})
