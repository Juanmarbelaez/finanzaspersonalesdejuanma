import { useMemo, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { useStore, useUI } from '../store'
import { useLocale, toast } from '../hooks'
import { parseISO, relativeDue, shortDate, todayISO } from '../lib/dates'
import { FREQUENCY_LABEL, advance, dueOccurrences } from '../lib/recurring'
import { choose } from '../components/Dialog'
import { uid } from '../lib/id'
import { haptic } from '../lib/haptic'
import type { Frequency, Recurring } from '../lib/types'
import { Sheet } from '../components/Sheet'
import { AmountDisplay, Keypad, useAmount } from '../components/Keypad'
import { TrendLine } from '../components/charts'
import { TxRow } from '../components/TxRow'
import { AccountCard, CatPill, Money, Segmented, Toggle } from '../components/ui'

const PER_YEAR: Record<Frequency, number> = { weekly: 52, biweekly: 24, monthly: 12, yearly: 1 }
const EVERY: Record<Frequency, string> = { weekly: 'cada semana', biweekly: 'cada quincena', monthly: 'cada mes', yearly: 'cada año' }

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

  // Los movimientos ya registrados se quedan; borrar el recurrente se puede deshacer
  const remove = () => {
    const undo = deleteRecurring(r.id)
    closeSheet()
    toast('Recurrente borrado', { label: 'Deshacer', run: undo })
  }

  return (
    <Sheet
      title={`Recurrente ${FREQUENCY_LABEL[r.frequency].toLowerCase()}`}
      footer={
        <div className="action-bar">
          <button onClick={() => openSheet({ name: 'recurringEdit', id })}>Editar</button>
          <button
            onClick={() => {
              upsertRecurring({ ...r, active: !r.active })
              toast(r.active ? 'En pausa: no se registra nada hasta que lo reanudes' : 'Reanudado desde hoy')
            }}
          >
            {r.active ? 'Pausar' : 'Reanudar'}
          </button>
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
            {relativeDue(r.nextDate)} ·{' '}
            {parseISO(r.nextDate).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        )}
      </div>

      {r.type === 'expense' && r.frequency !== 'yearly' && (
        <div className="note" style={{ marginTop: 18 }}>
          <CalendarDays size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            Al año son{' '}
            <b>
              <Money value={perYear} />
            </b>
            .
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
  const locale = useLocale()
  const today = todayISO()

  const [type, setType] = useState<'expense' | 'income'>(existing?.type ?? (tx?.type === 'income' ? 'income' : 'expense'))
  const [name, setName] = useState(existing?.name ?? tx?.name ?? '')
  const amount = useAmount(existing?.amount ?? tx?.amount ?? null)
  // Monto vacío al crear: el teclado arranca abierto, como en un movimiento nuevo
  const [pad, setPad] = useState(!existing && !tx)
  const [error, setError] = useState<{ field: 'name' | 'amount' | 'category'; msg: string; n: number } | null>(null)
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? tx?.categoryId ?? '')
  const [accountId, setAccountId] = useState(existing?.accountId ?? tx?.accountId ?? accounts[0]?.id ?? '')
  const [frequency, setFrequency] = useState<Frequency>(existing?.frequency ?? 'monthly')
  // Por defecto: el próximo cobro es en un mes (o un mes después del movimiento de origen)
  const [nextDate, setNextDate] = useState(
    existing?.nextDate ?? advance(tx?.date ?? today, 'monthly', Number((tx?.date ?? today).slice(8, 10))),
  )
  const [active, setActive] = useState(existing?.active ?? true)

  const kindCats = categories.filter((c) => c.kind === type)
  const press: typeof amount.press = (k) => {
    amount.press(k)
    if (error?.field === 'amount') setError(null)
  }

  const fail = (field: 'name' | 'amount' | 'category', msg: string) => {
    haptic()
    if (field !== 'amount') setPad(false)
    setError((e) => ({ field, msg, n: (e?.n ?? 0) + 1 }))
  }

  const save = async () => {
    if (!name.trim()) return fail('name', 'Ponle un nombre: Arriendo, Netflix…')
    if (!amount.value) return fail('amount', 'Escribe cuánto es')
    if (!categoryId) return fail('category', 'Elige una categoría')
    haptic()
    const r: Recurring = {
      id: existing?.id ?? uid(),
      name: name.trim(),
      amount: amount.value,
      type,
      categoryId,
      accountId,
      frequency,
      nextDate,
      anchorDay: Number(nextDate.slice(8, 10)),
      active,
    }
    // Fecha en el pasado: decir cuántos cobros se van a crear antes de crearlos
    // (al reanudar uno pausado nunca se cobra lo de atrás: lo hace el store)
    const due = r.active && existing?.active !== false ? dueOccurrences(r, today).dates.length : 0
    let fromToday = false
    if (due > 1) {
      const pick = await choose({
        title: `Se van a registrar ${due} cobros`,
        message: `Desde el ${shortDate(r.nextDate, locale)} hasta hoy. Si ya los anotaste a mano, mejor empieza desde hoy.`,
        confirm: `Registrar los ${due}`,
        alt: 'Solo desde hoy',
      })
      if (pick === 'cancel') return
      fromToday = pick === 'alt'
    }
    upsertRecurring(r, { fromToday })
    if (tx) updateTransaction(tx.id, { recurringId: r.id })
    toast(existing ? 'Recurrente actualizado' : 'Recurrente creado')
    closeSheet()
  }

  return (
    <Sheet
      title={existing ? 'Editar recurrente' : 'Nuevo recurrente'}
      footer={
        <>
          {pad && <Keypad onKey={press} decimals={amount.decimals} decimalSep={amount.decimalSep} />}
          <button className="save-bar" onClick={save}>
            Guardar
          </button>
        </>
      }
      footerBar
    >
      <Segmented<'expense' | 'income'>
        value={type}
        onChange={(t) => {
          setError(null)
          setType(t)
          if (categories.find((c) => c.id === categoryId)?.kind !== t) setCategoryId('')
        }}
        options={[
          { value: 'expense', label: 'Gasto fijo' },
          { value: 'income', label: 'Ingreso fijo' },
        ]}
      />

      <input
        key={error?.field === 'name' ? error.n : undefined}
        className={`big-input ${error?.field === 'name' ? 'shake' : ''}`}
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          if (error?.field === 'name') setError(null)
        }}
        onFocus={() => setPad(false)}
        placeholder="Arriendo, Netflix, salario…"
        aria-label="Nombre"
        style={{ marginTop: 18 }}
      />
      <div style={{ textAlign: 'center' }}>
        <AmountDisplay
          display={amount.display}
          empty={amount.empty}
          active={pad}
          onActivate={() => {
            ;(document.activeElement as HTMLElement | null)?.blur()
            setPad(true)
          }}
          shake={error?.field === 'amount' ? error.n : undefined}
          className={type === 'income' ? 'pos' : ''}
        />
      </div>
      {error && (
        <p className="caption neg" role="alert" style={{ textAlign: 'center', margin: '2px 0 0' }}>
          {error.msg}
        </p>
      )}

      <div
        key={error?.field === 'category' ? error.n : undefined}
        className={`picker-grid ${error?.field === 'category' ? 'shake' : ''}`}
        style={{ marginTop: 16 }}
      >
        {kindCats.map((c) => (
          <CatPill
            key={c.id}
            category={c}
            selected={categoryId === c.id}
            onClick={() => {
              haptic()
              setCategoryId(c.id)
              if (error?.field === 'category') setError(null)
            }}
          />
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
