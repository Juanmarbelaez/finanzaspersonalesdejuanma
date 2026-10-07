import { useMemo, useState } from 'react'
import { useStore, useUI } from '../store'
import { useLocale, toast } from '../hooks'
import { addMonths, parseISO, relativeDue, shortDate, todayISO } from '../lib/dates'
import { FREQUENCY_LABEL, advance } from '../lib/recurring'
import { uid } from '../lib/id'
import type { Frequency, Recurring } from '../lib/types'
import { Sheet } from '../components/Sheet'
import { AmountField } from '../components/AmountField'
import { TrendLine } from '../components/charts'
import { TxRow } from '../components/TxRow'
import { AccountCard, CatPill, Money, Segmented, Toggle } from '../components/ui'

const PER_YEAR: Record<Frequency, number> = { weekly: 52, biweekly: 26, monthly: 12, yearly: 1 }
const EVERY: Record<Frequency, string> = { weekly: 'cada semana', biweekly: 'cada quince días', monthly: 'cada mes', yearly: 'cada año' }

/* ---------------- Detalle ---------------- */

export function RecurringSheet({ id }: { id: string }) {
  const r = useStore((s) => s.recurrings.find((x) => x.id === id))
  const transactions = useStore((s) => s.transactions)
  const category = useStore((s) => s.categories.find((c) => c.id === r?.categoryId))
  const { upsertRecurring, deleteRecurring } = useStore.getState()
  const { openSheet, closeSheet } = useUI.getState()
  const locale = useLocale()

  const linked = useMemo(
    () => transactions.filter((t) => t.recurringId === id).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [transactions, id],
  )

  if (!r) return null

  const history = linked.slice(0, 5).reverse()
  const values = [...history.map((t) => t.amount), r.amount]
  const labels = [...history.map((t) => shortDate(t.date, locale)), shortDate(r.nextDate, locale)]
  const perYear = r.amount * PER_YEAR[r.frequency]

  const remove = () => {
    if (!confirm(`¿Borrar ${r.name}? Los movimientos que ya se registraron se quedan.`)) return
    deleteRecurring(r.id)
    toast('Recurrente borrado')
    closeSheet()
  }

  return (
    <Sheet
      title={`Recurrente ${FREQUENCY_LABEL[r.frequency].toLowerCase()}`}
      footer={
        <div className="action-bar">
          <button onClick={() => openSheet({ name: 'recurringEdit', id })}>Editar</button>
          <button onClick={() => upsertRecurring({ ...r, active: !r.active })}>{r.active ? 'Pausar' : 'Reanudar'}</button>
          <button className="danger" onClick={remove}>
            Borrar
          </button>
        </div>
      }
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 34, letterSpacing: 0 }}>{category?.emoji ?? '🔁'}</div>
        <h2 className="section-title" style={{ marginTop: 6 }}>
          {r.name}
        </h2>
        <p className="body" style={{ margin: '6px 0 10px' }}>
          {r.type === 'income' ? 'Ingreso' : 'Cobro'} de <Money value={r.amount} /> {EVERY[r.frequency]}
        </p>
        <CatPill category={category} />

        <div className="eyebrow gray" style={{ marginTop: 22 }}>
          {r.active ? 'Próximo pago' : 'Pausado'}
        </div>
        <div className={`display num ${r.type === 'income' ? 'pos' : ''}`} style={{ marginTop: 6 }}>
          <Money value={r.amount} />
        </div>
        {r.active && (
          <div className="caption" style={{ marginTop: 4, textTransform: 'none' }}>
            {relativeDue(r.nextDate)} · {parseISO(r.nextDate).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        )}
      </div>

      {r.type === 'expense' && r.frequency !== 'yearly' && (
        <div className="note" style={{ marginTop: 18 }}>
          <span style={{ letterSpacing: 0 }}>📅</span>
          <span>
            Al año son <b><Money value={perYear} /></b>.
          </span>
        </div>
      )}

      {values.length > 1 && (
        <div style={{ marginTop: 20 }}>
          <TrendLine values={values} labels={labels} dashedLast height={100} />
        </div>
      )}

      <div className="eyebrow" style={{ marginTop: 22 }}>
        {linked.length} {linked.length === 1 ? 'pago registrado' : 'pagos registrados'}
      </div>
      {linked.slice(0, 12).map((t) => (
        <TxRow key={t.id} tx={t} />
      ))}
    </Sheet>
  )
}

/* ---------------- Crear / editar ---------------- */

export function RecurringEditSheet({ id, fromTx }: { id?: string; fromTx?: string }) {
  const existing = useStore((s) => (id ? s.recurrings.find((r) => r.id === id) : undefined))
  const tx = useStore((s) => (fromTx ? s.transactions.find((t) => t.id === fromTx) : undefined))
  const categories = useStore((s) => s.categories)
  const accounts = useStore((s) => s.accounts)
  const { upsertRecurring, updateTransaction } = useStore.getState()
  const { closeSheet } = useUI.getState()
  const today = todayISO()

  const [type, setType] = useState<'expense' | 'income'>(existing?.type ?? (tx?.type === 'income' ? 'income' : 'expense'))
  const [name, setName] = useState(existing?.name ?? tx?.name ?? '')
  const [amount, setAmount] = useState<number | null>(existing?.amount ?? tx?.amount ?? null)
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? tx?.categoryId ?? '')
  const [accountId, setAccountId] = useState(existing?.accountId ?? tx?.accountId ?? accounts[0]?.id ?? '')
  const [frequency, setFrequency] = useState<Frequency>(existing?.frequency ?? 'monthly')
  // Por defecto: el próximo cobro es en un mes (o un mes después del movimiento de origen)
  const [nextDate, setNextDate] = useState(
    existing?.nextDate ?? (tx ? advance(tx.date, 'monthly', Number(tx.date.slice(8, 10))) : `${addMonths(today.slice(0, 7), 1)}-${today.slice(8, 10)}`),
  )
  const [active, setActive] = useState(existing?.active ?? true)

  const kindCats = categories.filter((c) => c.kind === type)
  const canSave = name.trim() && amount && amount > 0 && categoryId && accountId && nextDate

  const save = () => {
    if (!canSave || !amount) return
    const r: Recurring = {
      id: existing?.id ?? uid(),
      name: name.trim(),
      amount,
      type,
      categoryId,
      accountId,
      frequency,
      nextDate,
      anchorDay: Number(nextDate.slice(8, 10)),
      active,
    }
    upsertRecurring(r)
    if (tx) updateTransaction(tx.id, { recurringId: r.id })
    toast(existing ? 'Recurrente actualizado' : 'Recurrente creado')
    closeSheet()
  }

  return (
    <Sheet
      title={existing ? 'Editar recurrente' : 'Nuevo recurrente'}
      footer={
        <button className="save-bar" onClick={save} disabled={!canSave}>
          Guardar
        </button>
      }
      footerBar
    >
      <Segmented<'expense' | 'income'>
        value={type}
        onChange={(t) => {
          setType(t)
          if (categories.find((c) => c.id === categoryId)?.kind !== t) setCategoryId('')
        }}
        options={[
          { value: 'expense', label: 'Gasto fijo' },
          { value: 'income', label: 'Ingreso fijo' },
        ]}
      />

      <input
        className="big-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Arriendo, Netflix, salario…"
        aria-label="Nombre"
        style={{ marginTop: 18 }}
      />
      <AmountField value={amount} onChange={setAmount} variant="big" className={type === 'income' ? 'pos' : ''} />

      <div className="picker-grid" style={{ marginTop: 16 }}>
        {kindCats.map((c) => (
          <CatPill key={c.id} category={c} selected={categoryId === c.id} onClick={() => setCategoryId(c.id)} />
        ))}
      </div>

      <div className="eyebrow gray" style={{ textAlign: 'center', marginTop: 22 }}>
        Cuenta
      </div>
      <div className="acct-scroll">
        {accounts.map((a) => (
          <AccountCard key={a.id} account={a} selected={accountId === a.id} onClick={() => setAccountId(a.id)} />
        ))}
      </div>

      <div className="eyebrow gray" style={{ textAlign: 'center', margin: '14px 0 8px' }}>
        Frecuencia
      </div>
      <Segmented<Frequency>
        value={frequency}
        onChange={setFrequency}
        options={(Object.keys(FREQUENCY_LABEL) as Frequency[]).map((f) => ({ value: f, label: FREQUENCY_LABEL[f] }))}
      />

      <div className="list-group" style={{ marginTop: 16 }}>
        <div className="kv">
          <label className="k" htmlFor="rec-next">
            Próximo cobro
          </label>
          <input id="rec-next" type="date" value={nextDate} onChange={(e) => e.target.value && setNextDate(e.target.value)} />
        </div>
        {existing && (
          <div className="kv">
            <span className="k">Activo</span>
            <Toggle on={active} onChange={setActive} label="Activo" />
          </div>
        )}
      </div>
      <p className="caption" style={{ margin: '8px 4px 0' }}>
        {nextDate <= today
          ? 'Esa fecha ya llegó: se registra de una vez y queda por revisar.'
          : 'Cuando llegue la fecha se registra solo y te queda por revisar para confirmar el valor real.'}
      </p>
    </Sheet>
  )
}
