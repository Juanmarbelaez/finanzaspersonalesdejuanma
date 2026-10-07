import { useMemo } from 'react'
import { Check, Plus } from 'lucide-react'
import { useStore, useUI } from '../store'
import { useCategoryMap } from '../hooks'
import { currentMonth, monthKey } from '../lib/dates'
import { FREQUENCY_LABEL, monthlyEquivalent } from '../lib/recurring'
import type { Recurring } from '../lib/types'
import { Empty, Money, Ring } from '../components/ui'
import { Mascot } from '../components/Mascot'

export function Recurrings() {
  const recurrings = useStore((s) => s.recurrings)
  const transactions = useStore((s) => s.transactions)
  const openSheet = useUI((s) => s.openSheet)
  const cats = useCategoryMap()
  const month = currentMonth()

  // Lo que ya se cobró este mes de cada recurrente
  const paid = useMemo(() => {
    const m = new Map<string, { amount: number; date: string }>()
    for (const t of transactions) {
      if (!t.recurringId || monthKey(t.date) !== month) continue
      const cur = m.get(t.recurringId)
      m.set(t.recurringId, { amount: (cur?.amount ?? 0) + t.amount, date: t.date })
    }
    return m
  }, [transactions, month])

  const active = recurrings.filter((r) => r.active)
  const thisMonth = active
    .filter((r) => paid.has(r.id) || monthKey(r.nextDate) === month)
    .sort((a, b) => (paid.get(a.id)?.date ?? a.nextDate).localeCompare(paid.get(b.id)?.date ?? b.nextDate))
  const later = active.filter((r) => !thisMonth.includes(r)).sort((a, b) => a.nextDate.localeCompare(b.nextDate))
  const paused = recurrings.filter((r) => !r.active)

  const expenses = thisMonth.filter((r) => r.type === 'expense')
  const paidSum = expenses.reduce((s, r) => s + (paid.get(r.id)?.amount ?? 0), 0)
  const leftSum = expenses.filter((r) => monthKey(r.nextDate) === month).reduce((s, r) => s + r.amount, 0)
  const perMonth = active.filter((r) => r.type === 'expense').reduce((s, r) => s + monthlyEquivalent(r), 0)

  const tile = (r: Recurring, showPaid: boolean) => {
    const p = showPaid ? paid.get(r.id) : undefined
    const date = p?.date ?? r.nextDate
    return (
      <button key={r.id} className={`rec-tile ${p ? 'paid' : ''}`} onClick={() => openSheet({ name: 'recurring', id: r.id })}>
        {p && (
          <span className="check" aria-label="Pagado">
            <Check size={10} strokeWidth={4} />
          </span>
        )}
        <div className="e">{cats.get(r.categoryId)?.emoji ?? '🔁'}</div>
        <div className="n">{r.name}</div>
        <div className={`a ${r.type === 'income' ? 'pos' : ''}`}>
          <Money value={p?.amount ?? r.amount} />
        </div>
        <div className="d">
          {r.frequency === 'monthly' || !showPaid ? `día ${Number(date.slice(8, 10))}` : FREQUENCY_LABEL[r.frequency].toLowerCase()}
          {!showPaid && ` · ${date.slice(5, 7)}/${date.slice(2, 4)}`}
        </div>
      </button>
    )
  }

  if (!recurrings.length)
    return (
      <div className="screen">
        <Empty
          art={<Mascot pose="pointing" size={170} className="enter" />}
          title="Tus pagos fijos"
          text="Agrega arriendo, servicios y suscripciones. Se anotan solos el día del cobro y te quedan por revisar."
        >
          <button className="btn primary small" onClick={() => openSheet({ name: 'recurringEdit' })}>
            Agregar recurrente
          </button>
        </Empty>
      </div>
    )

  return (
    <div className="screen">
      <div className="stack">
        <section className="card" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8 }}>
          <div>
            <div className="display sm num" style={{ fontSize: 20 }}>
              <Money value={leftSum} />
            </div>
            <div className="caption">por pagar</div>
          </div>
          <Ring
            value={paidSum}
            max={paidSum + leftSum || 1}
            status="ok"
            text={`${Math.round((paidSum / (paidSum + leftSum || 1)) * 100)}%`}
            size={86}
            stroke={9}
          />
          <div style={{ textAlign: 'right' }}>
            <div className="display sm num" style={{ fontSize: 20 }}>
              <Money value={paidSum} />
            </div>
            <div className="caption">pagado</div>
          </div>
        </section>

        <section>
          <div className="section-head">
            <h2 className="eyebrow">Este mes</h2>
            <span className="caption">
              <Money value={perMonth} /> fijos al mes
            </span>
          </div>
          <div className="rec-grid">
            {thisMonth.map((r) => tile(r, true))}
            <button className="rec-tile add" onClick={() => openSheet({ name: 'recurringEdit' })} aria-label="Agregar recurrente">
              <Plus size={22} />
            </button>
          </div>
        </section>

        {later.length > 0 && (
          <section>
            <div className="section-head">
              <h2 className="eyebrow gray">Más adelante</h2>
            </div>
            <div className="rec-grid">{later.map((r) => tile(r, false))}</div>
          </section>
        )}

        {paused.length > 0 && (
          <section style={{ opacity: 0.55 }}>
            <div className="section-head">
              <h2 className="eyebrow gray">Pausados</h2>
            </div>
            <div className="rec-grid">{paused.map((r) => tile(r, false))}</div>
          </section>
        )}
      </div>
    </div>
  )
}
