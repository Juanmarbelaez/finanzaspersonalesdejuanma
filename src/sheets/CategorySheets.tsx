import { useMemo, useState } from 'react'
import { CircleCheck, Plus, Target, TriangleAlert } from 'lucide-react'
import { useStore, useUI } from '../store'
import { useLocale, toast } from '../hooks'
import { addMonths, currentMonth, daysInMonth, monthKey, monthLabel, todayISO } from '../lib/dates'
import { categoryHistory } from '../lib/selectors'
import { expectedCurve, fixedSchedule, projectMonth } from '../lib/pace'
import { FALLBACK_CATEGORY } from '../lib/seed'
import { uid } from '../lib/id'
import type { Category } from '../lib/types'
import { Sheet } from '../components/Sheet'
import { AmountDisplay, Keypad, useAmount } from '../components/Keypad'
import { haptic } from '../lib/haptic'
import { MonthBars } from '../components/charts'
import { TxRow } from '../components/TxRow'
import { Money, Segmented, statusColor, statusOf } from '../components/ui'

const ICON = { flexShrink: 0, marginTop: 2 }

/* ---------------- Detalle de categoría ---------------- */

export function CategorySheet({ id }: { id: string }) {
  const category = useStore((s) => s.categories.find((c) => c.id === id))
  const transactions = useStore((s) => s.transactions)
  const recurrings = useStore((s) => s.recurrings)
  const month = useUI((s) => s.month)
  const { openSheet, closeAll, setFilters, setTab, setMonth } = useUI.getState()
  const locale = useLocale()

  const history = useMemo(() => categoryHistory(transactions, id, month, 12), [transactions, id, month])
  const monthTx = useMemo(
    () => transactions.filter((t) => t.categoryId === id && monthKey(t.date) === month).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [transactions, id, month],
  )
  const year = month.slice(0, 4)
  const yearTotal = useMemo(
    () => transactions.reduce((s, t) => (t.categoryId === id && t.date.startsWith(year) ? s + t.amount : s), 0),
    [transactions, id, year],
  )

  if (!category) return null

  const spent = monthTx.reduce((s, t) => s + (t.type === 'transfer' ? 0 : t.amount), 0)
  const isCurrent = month === currentMonth()
  const dim = daysInMonth(month)
  const day = isCurrent ? Number(todayISO().slice(8, 10)) : dim
  const budget = category.budget
  const fixed = fixedSchedule(recurrings, month, id)
  const st = budget ? statusOf(spent, budget, expectedCurve(budget, fixed)[day - 1]) : 'ok'
  // Meses completos del año para el promedio (el mes en curso distorsiona)
  const fullMonths = isCurrent ? Number(month.slice(5, 7)) - 1 : Number(month.slice(5, 7))
  const avg = fullMonths > 0 ? (yearTotal - (isCurrent ? spent : 0)) / fullMonths : 0
  // Proyección al cierre: fijos completos + lo variable al ritmo que llevas
  const projected = isCurrent && day > 3 && category.kind === 'expense' ? projectMonth(spent, fixed, day) : null
  const recs = recurrings.filter((r) => r.categoryId === id)

  return (
    <Sheet
      title={category.kind === 'income' ? 'Categoría de ingreso' : 'Categoría'}
      footer={
        <div className="action-bar">
          <button onClick={() => openSheet({ name: 'categoryEdit', id })}>Editar</button>
          <button
            onClick={() => {
              setFilters({ categoryId: id })
              setTab('transactions')
              closeAll()
            }}
          >
            Ver movimientos
          </button>
        </div>
      }
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, letterSpacing: 0 }}>{category.emoji}</div>
        <h2 className="section-title" style={{ marginTop: 6 }}>
          {category.name}
        </h2>
        <div className="eyebrow gray" style={{ marginTop: 16 }}>
          {category.kind === 'income' ? 'Recibido' : 'Gastado'} · {monthLabel(month, locale)}
        </div>
        <div className="display num" style={{ marginTop: 6 }}>
          <Money value={spent} />
        </div>
        {budget ? (
          <div className="caption" style={{ color: statusColor(st), marginTop: 4 }}>
            <Money value={Math.abs(budget - spent)} /> {spent > budget ? 'de más' : 'quedan'} de <Money value={budget} />
          </div>
        ) : null}
      </div>

      {projected !== null && budget ? (
        <div className={`note ${spent > budget || projected > budget ? 'warn' : 'good'}`} style={{ marginTop: 18 }}>
          {spent > budget || projected > budget ? <TriangleAlert size={18} style={ICON} /> : <CircleCheck size={18} style={ICON} />}
          {spent > budget ? (
            <span>
              Ya te pasaste por{' '}
              <b>
                <Money value={spent - budget} />
              </b>
              . Lo que gastes en {category.name.toLowerCase()} hasta fin de mes se suma. Si puedes, frena hasta el 1.
            </span>
          ) : projected > budget ? (
            <span>
              A este ritmo cierras en{' '}
              <b>
                ≈<Money value={Math.round(projected / 1000) * 1000} />
              </b>
              . Para no pasarte: máximo{' '}
              <b>
                <Money value={(budget - spent) / (dim - day + 1)} />
              </b>{' '}
              por día los {dim - day + 1} días que quedan.
            </span>
          ) : (
            <span>
              A este ritmo cierras en{' '}
              <b>
                ≈<Money value={Math.round(projected / 1000) * 1000} />
              </b>
              , <Money value={budget - projected} /> por debajo. Vas bien.
            </span>
          )}
        </div>
      ) : null}

      {!isCurrent && budget && spent <= budget && spent > 0 ? (
        <div className="note good celebrate" style={{ marginTop: 18 }}>
          <Target size={22} style={{ flexShrink: 0 }} />
          <span>
            Cerraste {monthLabel(month, locale).toLowerCase()}{' '}
            <b>
              <Money value={budget - spent} />
            </b>{' '}
            por debajo del presupuesto.
          </span>
        </div>
      ) : null}

      <div style={{ marginTop: 22 }}>
        <MonthBars data={history} budget={budget} selected={month} onSelect={setMonth} />
      </div>

      <div className="eyebrow" style={{ marginTop: 24 }}>
        Métricas {year}
      </div>
      <div className="metrics" style={{ marginTop: 4 }}>
        <div className="kv">
          <span className="k">Total este año</span>
          <span className="v">
            <Money value={yearTotal} />
          </span>
        </div>
        <div className="kv">
          <span className="k">Promedio por mes</span>
          <span className="v">{avg ? <Money value={avg} /> : '—'}</span>
        </div>
      </div>

      {recs.length > 0 && (
        <>
          <div className="eyebrow" style={{ marginTop: 20 }}>
            Recurrentes
          </div>
          <div className="upcoming" style={{ margin: '8px -20px 0', padding: '0 20px 4px' }}>
            {recs.map((r) => (
              <button key={r.id} className="mini" onClick={() => openSheet({ name: 'recurring', id: r.id })}>
                <span className="n">{r.name}</span>
                <Money value={r.amount} />
              </button>
            ))}
          </div>
        </>
      )}

      <div className="eyebrow" style={{ marginTop: 22 }}>
        Movimientos de {monthLabel(month, locale, false).toLowerCase()}
      </div>
      {monthTx.length ? (
        monthTx.slice(0, 25).map((t) => <TxRow key={t.id} tx={t} />)
      ) : (
        <p className="body" style={{ marginTop: 8 }}>
          Nada este mes.
        </p>
      )}
    </Sheet>
  )
}

/* ---------------- Crear / editar categoría ---------------- */

const EMOJIS = [
  '🛒',
  '🍔',
  '☕',
  '🍺',
  '🍕',
  '🥗',
  '🚗',
  '⛽',
  '🚌',
  '🏍️',
  '🏠',
  '💡',
  '📱',
  '💻',
  '🛍️',
  '👕',
  '💪',
  '🏋️',
  '💊',
  '🩺',
  '🎬',
  '🎮',
  '🎵',
  '✈️',
  '🏖️',
  '📚',
  '🎓',
  '🎁',
  '🐶',
  '👶',
  '💇',
  '🧾',
  '💳',
  '🏦',
  '💼',
  '💸',
  '📈',
  '🪙',
  '🎉',
  '🛠️',
  '❤️',
  '💍',
  '🧴',
  '🧹',
  '📦',
  '🌱',
  '⚽',
  '🍷',
]

export function CategoryEditSheet({ id, kind: presetKind }: { id?: string; kind?: 'expense' | 'income' }) {
  const existing = useStore((s) => (id ? s.categories.find((c) => c.id === id) : undefined))
  const count = useStore((s) => (id ? s.transactions.filter((t) => t.categoryId === id).length : 0))
  const transactions = useStore((s) => s.transactions)
  const { upsertCategory, deleteCategory } = useStore.getState()
  const { closeSheet, closeAll } = useUI.getState()

  const [kind, setKind] = useState<'expense' | 'income'>(existing?.kind ?? presetKind ?? 'expense')
  const [emoji, setEmoji] = useState(existing?.emoji ?? '🧾')
  const [pickEmoji, setPickEmoji] = useState(!existing)
  const [name, setName] = useState(existing?.name ?? '')
  const budget = useAmount(existing?.budget ?? null)
  const [pad, setPad] = useState(false)
  const [error, setError] = useState<{ msg: string; n: number } | null>(null)

  const isFallback = id === FALLBACK_CATEGORY.expense || id === FALLBACK_CATEGORY.income

  // Anticipar: el promedio de los últimos 3 meses completos como presupuesto sugerido
  const suggested = useMemo(() => {
    if (!existing || existing.kind !== 'expense') return null
    const months = [1, 2, 3].map((i) => addMonths(currentMonth(), -i))
    const total = transactions.reduce(
      (s, t) => (t.categoryId === existing.id && t.type === 'expense' && months.includes(monthKey(t.date)) ? s + t.amount : s),
      0,
    )
    const avg = Math.round(total / 3 / 1000) * 1000
    return avg > 0 ? avg : null
  }, [existing, transactions])

  const save = () => {
    if (!name.trim()) {
      haptic()
      setPad(false)
      return setError((e) => ({ msg: 'Ponle un nombre a la categoría', n: (e?.n ?? 0) + 1 }))
    }
    haptic()
    const c: Category = {
      id: existing?.id ?? uid(),
      name: name.trim(),
      emoji,
      color: existing?.color ?? '#4CA626',
      kind,
      budget: kind === 'expense' && budget.value ? budget.value : null,
    }
    upsertCategory(c)
    toast(existing ? 'Categoría actualizada' : 'Categoría creada')
    closeSheet()
  }

  // No se pierde nada (los movimientos pasan a Otros), así que no se pregunta: se puede deshacer
  const remove = () => {
    if (!existing) return
    const undo = deleteCategory(existing.id)
    closeAll()
    toast(count ? `Borrada · ${count} movimientos a ${kind === 'income' ? 'Otros ingresos' : 'Otros'}` : 'Categoría borrada', {
      label: 'Deshacer',
      run: undo,
    })
  }

  return (
    <Sheet
      title={existing ? 'Editar categoría' : 'Nueva categoría'}
      footer={
        <>
          {pad && kind === 'expense' && <Keypad onKey={budget.press} decimals={budget.decimals} decimalSep={budget.decimalSep} />}
          <button className="save-bar" onClick={save}>
            Guardar
          </button>
        </>
      }
      footerBar
    >
      {!existing && (
        <Segmented<'expense' | 'income'>
          value={kind}
          onChange={setKind}
          options={[
            { value: 'expense', label: 'Gasto' },
            { value: 'income', label: 'Ingreso' },
          ]}
        />
      )}

      <div style={{ textAlign: 'center', marginTop: 18 }}>
        <button onClick={() => setPickEmoji((v) => !v)} style={{ fontSize: 40, letterSpacing: 0 }} aria-label="Cambiar emoji">
          {emoji}
        </button>
      </div>
      {pickEmoji && (
        <div className="emoji-grid">
          {EMOJIS.map((e) => (
            <button
              key={e}
              className={e === emoji ? 'selected' : ''}
              onClick={() => {
                setEmoji(e)
                setPickEmoji(false)
              }}
            >
              {e}
            </button>
          ))}
        </div>
      )}

      <input
        key={error?.n}
        className={`big-input ${error ? 'shake' : ''}`}
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          setError(null)
        }}
        onFocus={() => setPad(false)}
        placeholder="Nombre de la categoría"
        aria-label="Nombre de la categoría"
        style={{ marginTop: 8 }}
      />
      {error && (
        <p className="caption neg" style={{ textAlign: 'center', margin: '2px 0 0' }}>
          {error.msg}
        </p>
      )}

      {kind === 'expense' && (
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <div className="eyebrow gray">Presupuesto mensual</div>
          <AmountDisplay
            display={budget.display}
            empty={budget.empty}
            active={pad}
            onActivate={() => setPad(true)}
            label="Presupuesto mensual"
          />
          {suggested && budget.value !== suggested ? (
            <div className="chip-row" style={{ marginTop: 6 }}>
              <button
                type="button"
                onClick={() => {
                  haptic()
                  budget.setRaw(String(suggested))
                }}
              >
                Promedio de 3 meses: <Money value={suggested} /> · Usar
              </button>
            </div>
          ) : (
            <p className="caption" style={{ margin: '4px 0 0' }}>
              Déjalo en 0 si no quieres límite.
            </p>
          )}
        </div>
      )}

      {existing && !isFallback && (
        <button className="btn ghost-danger block" style={{ marginTop: 28 }} onClick={remove}>
          Borrar categoría
        </button>
      )}
    </Sheet>
  )
}

/* ---------------- Administrar categorías ---------------- */

export function CategoriesManageSheet() {
  const categories = useStore((s) => s.categories)
  const openSheet = useUI((s) => s.openSheet)

  const group = (kind: 'expense' | 'income', title: string) => (
    <>
      <div className="eyebrow gray group-title">{title}</div>
      <div className="list-group">
        {categories
          .filter((c) => c.kind === kind)
          .map((c) => (
            <button key={c.id} className="item" onClick={() => openSheet({ name: 'categoryEdit', id: c.id })}>
              <span>
                <span style={{ letterSpacing: 0, marginRight: 10 }}>{c.emoji}</span>
                {c.name}
              </span>
              <span className="r">{c.budget ? <Money value={c.budget} /> : kind === 'expense' ? 'Sin límite' : ''}</span>
            </button>
          ))}
      </div>
    </>
  )

  return (
    <Sheet
      title="Categorías"
      full
      footer={
        <button className="btn primary block" onClick={() => openSheet({ name: 'categoryEdit' })}>
          <Plus size={18} /> Nueva categoría
        </button>
      }
    >
      {group('expense', 'Gastos')}
      {group('income', 'Ingresos')}
    </Sheet>
  )
}
