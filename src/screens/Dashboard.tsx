import { useMemo } from 'react'
import { Check } from 'lucide-react'
import { useStore, useUI } from '../store'
import { useCategoryMap, useCountUp, useLocale } from '../hooks'
import { addMonths, currentMonth, dayLabel, monthKey, relativeDue, todayISO } from '../lib/dates'
import { cumulativeDaily, inMonth, spendByCategory, totalBudget, totals } from '../lib/selectors'
import { expectedCurve, fixedSchedule } from '../lib/pace'
import { PaceChart } from '../components/charts'
import { haptic } from '../lib/haptic'
import { TxRow } from '../components/TxRow'
import { Delta, Money, Ring, SectionHead, statusOf } from '../components/ui'

export function Dashboard() {
  const transactions = useStore((s) => s.transactions)
  const categories = useStore((s) => s.categories)
  const recurrings = useStore((s) => s.recurrings)
  const accounts = useStore((s) => s.accounts)
  const setReviewed = useStore((s) => s.setReviewed)
  const { setTab, openSheet, setFilters, setMonth } = useUI.getState()
  const cats = useCategoryMap()
  const locale = useLocale()

  const today = todayISO()
  const month = currentMonth()
  const day = Number(today.slice(8, 10))

  const d = useMemo(() => {
    const monthTx = inMonth(transactions, month)
    const prevMonth = addMonths(month, -1)
    // Mes pasado hasta el mismo día, para comparar justo
    const prevSoFar = transactions.filter((t) => monthKey(t.date) === prevMonth && Number(t.date.slice(8, 10)) <= day)
    return {
      t: totals(monthTx),
      prevT: totals(prevSoFar),
      current: cumulativeDaily(transactions, month),
      previous: cumulativeDaily(transactions, prevMonth),
      byCat: spendByCategory(monthTx),
      unreviewed: transactions
        .filter((x) => !x.reviewed)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt)),
    }
  }, [transactions, month, day])

  const budget = totalBudget(categories)
  // Ritmo esperado con los pagos fijos en su día (el arriendo no cuenta como "ir rápido")
  const expected = useMemo(() => expectedCurve(budget, fixedSchedule(recurrings, month)), [budget, recurrings, month])
  const expectedFor = (id: string, b: number) => expectedCurve(b, fixedSchedule(recurrings, month, id))[day - 1]
  const spent = d.t.expense
  const left = budget - spent
  const hero = useCountUp(budget ? Math.abs(left) : spent)

  const rings = categories
    .filter((c) => c.kind === 'expense' && c.budget)
    .map((c) => ({ c, spent: d.byCat.get(c.id) ?? 0 }))
    .sort((a, b) => b.spent / b.c.budget! - a.spent / a.c.budget!)

  const upcoming = recurrings
    .filter((r) => r.active)
    .sort((a, b) => (a.nextDate < b.nextDate ? -1 : 1))
    .slice(0, 8)
  const upcomingGroups: { label: string; items: typeof upcoming }[] = []
  for (const r of upcoming) {
    const label = relativeDue(r.nextDate, today).toLowerCase()
    const g = upcomingGroups[upcomingGroups.length - 1]
    if (g && g.label === label) g.items.push(r)
    else upcomingGroups.push({ label, items: [r] })
  }

  const review = d.unreviewed.slice(0, 5)
  const reviewHead = review.length && review[0].date === today ? 'Lo de hoy' : review.length ? dayLabel(review[0].date, locale) : ''

  // Configuración inicial: arranca con lo que ya viene hecho (cuentas y categorías)
  const steps = [
    {
      label: 'Cuentas y categorías listas',
      done: accounts.length > 0 && categories.length > 0,
    },
    {
      label: 'Pon el saldo real de tus cuentas',
      done: accounts.some((a) => a.startingBalance !== 0),
      go: () => setTab('accounts'),
    },
    {
      label: 'Registra tu primer movimiento',
      done: transactions.length > 0,
      go: () => openSheet({ name: 'tx' }),
    },
    {
      label: 'Ponle presupuesto a una categoría',
      done: budget > 0,
      go: () => setTab('categories'),
    },
    {
      label: 'Agrega un pago recurrente',
      done: recurrings.length > 0,
      go: () => openSheet({ name: 'recurringEdit' }),
    },
  ]
  const doneSteps = steps.filter((s) => s.done).length

  return (
    <div className="screen">
      <div className="stack">
        <section className="card center" style={{ paddingBottom: 12 }}>
          {budget > 0 ? (
            <>
              <div className={`display num ${left < 0 ? 'neg' : ''}`}>
                <Money value={hero} />
                <span className="word">{left >= 0 ? 'quedan' : 'de más'}</span>
              </div>
              <div className="hero-sub">
                de <Money value={budget} /> presupuestados
              </div>
            </>
          ) : (
            <>
              <div className="display num">
                <Money value={hero} />
                <span className="word">gastados</span>
              </div>
              <div className="hero-sub">
                <Money value={d.previous[Math.min(day, d.previous.length) - 1] ?? 0} /> el mes pasado a esta altura
              </div>
            </>
          )}
          <PaceChart cumulative={d.current} previous={d.previous} budget={budget || null} expected={expected} upToDay={day} month={month} />
        </section>

        {doneSteps < steps.length && (
          <section className="card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}
            >
              <span className="eyebrow">Configura tu plata</span>
              <span className="caption">
                {doneSteps} de {steps.length}
              </span>
            </div>
            <div className="bar" style={{ margin: '12px 0 8px' }}>
              <span
                style={{
                  width: `${(doneSteps / steps.length) * 100}%`,
                  background: 'var(--accent)',
                }}
              />
            </div>
            <div className="setup">
              {steps.map((s) => (
                <button key={s.label} className={`step ${s.done ? 'done' : ''}`} onClick={s.done ? undefined : s.go} disabled={s.done}>
                  <span className="ck">{s.done && <Check size={13} strokeWidth={3} />}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </section>
        )}

        {review.length > 0 && (
          <section>
            <SectionHead
              title="Por revisar"
              more="Ver todo"
              onMore={() => {
                setFilters({ review: true })
                setTab('transactions')
              }}
            />
            <div className="card tight">
              <div className="subtle-head">{reviewHead}</div>
              {review.map((t) => (
                <TxRow key={t.id} tx={t} />
              ))}
              <button
                className="review-btn"
                onClick={() => {
                  haptic()
                  setReviewed(d.unreviewed.map((t) => t.id))
                }}
              >
                {d.unreviewed.length > review.length ? `Marcar los ${d.unreviewed.length} como revisados` : 'Marcar como revisado'}
              </button>
            </div>
          </section>
        )}

        {rings.length > 0 && (
          <section>
            <SectionHead
              title="Presupuestos"
              more="Categorías"
              onMore={() => {
                setMonth(month)
                setTab('categories')
              }}
            />
            <div className="rings">
              {rings.map(({ c, spent: s }) => {
                const rest = c.budget! - s
                return (
                  <button key={c.id} className="ring-item" onClick={() => openSheet({ name: 'category', id: c.id })} aria-label={c.name}>
                    <Ring value={s} max={c.budget!} status={statusOf(s, c.budget!, expectedFor(c.id, c.budget!))} emoji={c.emoji} />
                    <div className={`val ${rest < 0 ? 'neg' : ''}`}>
                      <Money value={Math.abs(rest)} compact={Math.abs(rest) >= 1e6} />
                    </div>
                    <div className="lbl">{rest < 0 ? 'de más' : 'quedan'}</div>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {upcomingGroups.length > 0 && (
          <section>
            <SectionHead title="Próximos pagos" more="Recurrentes" onMore={() => setTab('recurrings')} />
            <div className="upcoming">
              {upcomingGroups.map((g) => (
                <div key={g.label} className="group">
                  <div className="when caption">{g.label}</div>
                  <div className="items">
                    {g.items.map((r) => (
                      <button key={r.id} className="mini" onClick={() => openSheet({ name: 'recurring', id: r.id })}>
                        <span style={{ letterSpacing: 0 }}>{cats.get(r.categoryId)?.emoji ?? '🔁'}</span>
                        <span className="n">{r.name}</span>
                        <Money value={r.amount} className={r.type === 'income' ? 'pos' : ''} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <SectionHead title="Neto del mes" more="Flujo de caja" onMore={() => setTab('cashflow')} />
          <button className="card" onClick={() => setTab('cashflow')}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <span className={`display sm num ${d.t.net < 0 ? 'neg' : ''}`}>
                <Money value={d.t.net} />
              </span>
              <Delta current={d.t.net} previous={d.prevT.net} />
            </div>
            <div className="split-bar" aria-hidden>
              <span
                style={{
                  flexGrow: d.t.income || 0.0001,
                  background: 'var(--accent)',
                }}
              />
              <span
                style={{
                  flexGrow: d.t.expense || 0.0001,
                  background: 'var(--text)',
                }}
              />
            </div>
            <div className="legend-row">
              <div>
                <div className="caption">Ingresos</div>
                <div className="v">
                  <i style={{ background: 'var(--accent)' }} />
                  <Money value={d.t.income} className="pos" />
                </div>
              </div>
              <div>
                <div className="caption">Gastos</div>
                <div className="v">
                  <i style={{ background: 'var(--text)' }} />
                  <Money value={d.t.expense} />
                </div>
              </div>
            </div>
          </button>
        </section>
      </div>
    </div>
  )
}
