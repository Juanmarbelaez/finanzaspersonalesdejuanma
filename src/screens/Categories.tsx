import { useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import { useStore, useUI } from '../store'
import { useLocale } from '../hooks'
import { currentMonth, daysInMonth, monthLabel, todayISO } from '../lib/dates'
import { incomeByCategory, inMonth, spendByCategory, totalBudget } from '../lib/selectors'
import { expectedCurve, fixedSchedule } from '../lib/pace'
import type { Category } from '../lib/types'
import { Money, Ring, statusColor, statusOf } from '../components/ui'

export function Categories() {
  const transactions = useStore((s) => s.transactions)
  const categories = useStore((s) => s.categories)
  const recurrings = useStore((s) => s.recurrings)
  const month = useUI((s) => s.month)
  const openSheet = useUI((s) => s.openSheet)
  const locale = useLocale()

  const isCurrent = month === currentMonth()
  const dim = daysInMonth(month)
  const day = isCurrent ? Number(todayISO().slice(8, 10)) : dim
  // Lo esperado a hoy, con los pagos fijos en su fecha real
  const expectedFor = (b: number, id?: string) => expectedCurve(b, fixedSchedule(recurrings, month, id))[day - 1]
  const monthTx = useMemo(() => inMonth(transactions, month), [transactions, month])
  const spend = useMemo(() => spendByCategory(monthTx), [monthTx])
  const income = useMemo(() => incomeByCategory(monthTx), [monthTx])

  const budget = totalBudget(categories)
  const spent = [...spend.values()].reduce((s, v) => s + v, 0)
  const expense = categories.filter((c) => c.kind === 'expense')
  const ratio = (c: Category) => (spend.get(c.id) ?? 0) / (c.budget || Infinity)
  const sorted = [...expense].sort((a, b) => ratio(b) - ratio(a) || (spend.get(b.id) ?? 0) - (spend.get(a.id) ?? 0))
  const incomeCats = categories.filter((c) => c.kind === 'income' && income.get(c.id))

  return (
    <div className="screen">
      <div className="stack">
        <section className="card" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8 }}>
          <div>
            <div className="display sm num" style={{ fontSize: 20 }}>
              <Money value={spent} />
            </div>
            <button
              className="caption"
              onClick={() => openSheet({ name: 'month' })}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}
            >
              gastado en {monthLabel(month, locale, false).toLowerCase()} <ChevronDown size={13} />
            </button>
          </div>
          <Ring
            value={spent}
            max={budget || 1}
            status={budget ? statusOf(spent, budget, expectedFor(budget)) : 'ok'}
            text={budget ? `${Math.round((spent / budget) * 100)}%` : '—'}
            size={86}
            stroke={9}
          />
          <div style={{ textAlign: 'right' }}>
            <div className="display sm num" style={{ fontSize: 20 }}>
              <Money value={budget} />
            </div>
            <div className="caption">presupuesto total</div>
          </div>
        </section>

        <section>
          <div className="cat-table-head eyebrow gray">
            <span />
            <span>Gastado</span>
            <span />
            <span>Presup.</span>
          </div>
          {sorted.map((c) => {
            const s = spend.get(c.id) ?? 0
            const st = c.budget ? statusOf(s, c.budget, expectedFor(c.budget, c.id)) : 'ok'
            return (
              <button key={c.id} className="cat-line" onClick={() => openSheet({ name: 'category', id: c.id })}>
                <span className="nm">
                  <span className="e">{c.emoji}</span>
                  <span>{c.name}</span>
                </span>
                <span className={`spent num ${!s ? 'muted' : ''}`}>
                  <Money value={s} compact={s >= 1e6} />
                </span>
                <span className="bar" aria-hidden>
                  {c.budget ? <span style={{ width: `${Math.min(100, (s / c.budget) * 100)}%`, background: statusColor(st) }} /> : null}
                </span>
                <span className="budget num">{c.budget ? <Money value={c.budget} compact /> : '—'}</span>
              </button>
            )
          })}
        </section>

        {incomeCats.length > 0 && (
          <section>
            <div className="eyebrow gray" style={{ margin: '0 2px 6px' }}>
              Ingresos del mes
            </div>
            {incomeCats.map((c) => (
              <button
                key={c.id}
                className="cat-line"
                style={{ gridTemplateColumns: '1fr auto' }}
                onClick={() => openSheet({ name: 'category', id: c.id })}
              >
                <span className="nm">
                  <span className="e">{c.emoji}</span>
                  <span>{c.name}</span>
                </span>
                <span className="spent pos">
                  <Money value={income.get(c.id) ?? 0} sign />
                </span>
              </button>
            ))}
          </section>
        )}

        <div style={{ textAlign: 'center' }}>
          <button className="btn small outline" onClick={() => openSheet({ name: 'categoriesManage' })}>
            Editar categorías
          </button>
        </div>
      </div>
    </div>
  )
}
