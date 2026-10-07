import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useStore, useUI } from '../store'
import { useCategoryMap, useLocale } from '../hooks'
import { addMonths, currentMonth, daysInMonth, monthKey, monthLabel, shortMonthLabel, todayISO } from '../lib/dates'
import { inMonth, monthSeries, spendByCategory, totals } from '../lib/selectors'
import { formatPercent } from '../lib/format'
import type { Transaction } from '../lib/types'
import { FlowBars } from '../components/charts'
import { Delta, Money, Periods } from '../components/ui'

type Period = 'month' | '6m' | '1y'

interface Point {
  label: string
  tip: string
  income: number
  expense: number
}

function dailyPoints(txs: Transaction[], month: string, upTo: number, locale: string): Point[] {
  const dim = daysInMonth(month)
  const pts: Point[] = Array.from({ length: dim }, (_, i) => ({
    label: String(i + 1),
    tip: `${i + 1} ${shortMonthLabel(month, locale).toLowerCase()}`,
    income: 0,
    expense: 0,
  }))
  for (const t of txs) {
    if (monthKey(t.date) !== month) continue
    const p = pts[Number(t.date.slice(8, 10)) - 1]
    if (t.type === 'income') p.income += t.amount
    else if (t.type === 'expense') p.expense += t.amount
  }
  return pts.slice(0, upTo)
}

export function CashFlow() {
  const transactions = useStore((s) => s.transactions)
  const month = useUI((s) => s.month)
  const openSheet = useUI((s) => s.openSheet)
  const locale = useLocale()
  const cats = useCategoryMap()
  const [period, setPeriod] = useState<Period>('month')

  const isCurrent = month === currentMonth()
  const upTo = isCurrent ? Number(todayISO().slice(8, 10)) : daysInMonth(month)

  const data = useMemo(() => {
    if (period === 'month') {
      const pts = dailyPoints(transactions, month, upTo, locale)
      const cur = inMonth(transactions, month)
      const prevMonth = addMonths(month, -1)
      const prev = transactions.filter((t) => monthKey(t.date) === prevMonth && Number(t.date.slice(8, 10)) <= upTo)
      return { pts, cur, prev, range: monthLabel(month, locale), labelEvery: 5 }
    }
    const n = period === '6m' ? 6 : 12
    const end = currentMonth()
    const series = monthSeries(transactions, end, n)
    const start = addMonths(end, -n + 1)
    const prevStart = addMonths(start, -n)
    const cur = transactions.filter((t) => monthKey(t.date) >= start)
    const prev = transactions.filter((t) => monthKey(t.date) >= prevStart && monthKey(t.date) < start)
    const pts = series.map((p) => ({
      label: shortMonthLabel(p.month, locale).charAt(0),
      tip: monthLabel(p.month, locale),
      income: p.income,
      expense: p.expense,
    }))
    return { pts, cur, prev, range: `${monthLabel(start, locale)} – ${monthLabel(end, locale)}`, labelEvery: 1 }
  }, [transactions, period, month, upTo, locale])

  const t = totals(data.cur)
  const p = totals(data.prev)
  const byCat = [...spendByCategory(data.cur)].sort((a, b) => b[1] - a[1])
  const top = byCat.slice(0, 5)
  const rest = byCat.slice(5).reduce((s, [, v]) => s + v, 0)

  return (
    <div className="screen">
      <div className="stack">
        <Periods<Period>
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'month', label: 'Mes' },
            { value: '6m', label: '6 meses' },
            { value: '1y', label: '1 año' },
          ]}
        />

        <section className="card center">
          <div className="eyebrow gray">Neto</div>
          {period === 'month' ? (
            <button
              className="caption"
              onClick={() => openSheet({ name: 'month' })}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginTop: 4 }}
            >
              {data.range} <ChevronDown size={13} />
            </button>
          ) : (
            <div className="caption" style={{ marginTop: 4 }}>
              {data.range}
            </div>
          )}
          <div className={`display num ${t.net < 0 ? 'neg' : ''}`} style={{ margin: '8px 0 6px' }}>
            <Money value={t.net} />
          </div>
          <Delta current={t.net} previous={p.net} />
          <div style={{ marginTop: 18 }}>
            <FlowBars
              mode="net"
              labelEvery={data.labelEvery}
              data={data.pts.map((x) => ({ label: x.label, tip: x.tip, value: x.income - x.expense }))}
            />
          </div>
          <div className="legend-row" style={{ marginTop: 16, textAlign: 'left' }}>
            <div>
              <div className="caption">Tasa de ahorro</div>
              <div className="v">{t.savingsRate === null ? '—' : formatPercent(t.savingsRate, locale)}</div>
            </div>
            <div>
              <div className="caption">{period === 'month' ? 'Mes pasado a esta altura' : 'Periodo anterior'}</div>
              <div className="v">
                <Money value={p.net} />
              </div>
            </div>
          </div>
        </section>

        <section className="card center">
          <div className="eyebrow gray">Gastos</div>
          <div className="display sm num" style={{ margin: '8px 0 6px' }}>
            <Money value={t.expense} />
          </div>
          <Delta current={t.expense} previous={p.expense} invert />
          <div style={{ marginTop: 18 }}>
            <FlowBars
              mode="spend"
              labelEvery={data.labelEvery}
              data={data.pts.map((x) => ({ label: x.label, tip: x.tip, value: x.expense }))}
            />
          </div>
          {top.length > 0 && (
            <div style={{ marginTop: 16, textAlign: 'left' }}>
              {top.map(([id, v]) => {
                const c = cats.get(id)
                return (
                  <button
                    key={id}
                    className="cat-line"
                    style={{ gridTemplateColumns: 'minmax(0,1fr) auto auto' }}
                    onClick={() => openSheet({ name: 'category', id })}
                  >
                    <span className="nm">
                      <span className="e">{c?.emoji ?? '❔'}</span>
                      <span>{c?.name ?? 'Sin categoría'}</span>
                    </span>
                    <span className="caption">{formatPercent(t.expense ? v / t.expense : 0, locale)}</span>
                    <span className="spent">
                      <Money value={v} />
                    </span>
                  </button>
                )
              })}
              {rest > 0 && (
                <div className="cat-line" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
                  <span className="nm muted">Todas las demás</span>
                  <span className="spent muted">
                    <Money value={rest} />
                  </span>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="card center">
          <div className="eyebrow gray">Ingresos</div>
          <div className="display sm num pos" style={{ margin: '8px 0 6px' }}>
            <Money value={t.income} />
          </div>
          <Delta current={t.income} previous={p.income} />
          <div style={{ marginTop: 18 }}>
            <FlowBars
              mode="income"
              labelEvery={data.labelEvery}
              data={data.pts.map((x) => ({ label: x.label, tip: x.tip, value: x.income }))}
            />
          </div>
        </section>
      </div>
    </div>
  )
}
