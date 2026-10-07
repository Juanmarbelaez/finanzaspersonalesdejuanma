import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useStore, useUI } from '../store'
import { useLocale, toast } from '../hooks'
import { currentMonth, daysInMonth, monthKey, monthLabel, todayISO } from '../lib/dates'
import { categoryHistory } from '../lib/selectors'
import { expectedCurve, fixedSchedule, projectMonth } from '../lib/pace'
import { FALLBACK_CATEGORY } from '../lib/seed'
import { uid } from '../lib/id'
import type { Category } from '../lib/types'
import { Sheet } from '../components/Sheet'
import { AmountField } from '../components/AmountField'
import { MonthBars } from '../components/charts'
import { TxRow } from '../components/TxRow'
import { Money, Segmented, statusColor, statusOf } from '../components/ui'

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
  // Proyección honesta: fijos completos + lo variable al ritmo que llevas
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
            <Money value={Math.abs(budget - spent)} /> {spent > budget ? 'de más' : 'libres'} de <Money value={budget} />
          </div>
        ) : null}
      </div>

      {projected !== null && budget ? (
        <div className={`note ${spent > budget || projected > budget ? 'warn' : 'good'}`} style={{ marginTop: 18 }}>
          <span style={{ letterSpacing: 0 }}>{spent > budget || projected > budget ? '⚠️' : '✅'}</span>
          {spent > budget ? (
            <span>
              Ya te pasaste por <b><Money value={spent - budget} /></b>. Lo que gastes en {category.name.toLowerCase()} de aquí a fin de mes suma a eso: si puedes, frénala hasta el 1.
            </span>
          ) : projected > budget ? (
            <span>
              A este ritmo cierras en <b>≈<Money value={Math.round(projected / 1000) * 1000} /></b>. Para no pasarte: máximo{' '}
              <b><Money value={(budget - spent) / (dim - day + 1)} /></b> por día los {dim - day + 1} días que quedan.
            </span>
          ) : (
            <span>
              A este ritmo cierras en <b>≈<Money value={Math.round(projected / 1000) * 1000} /></b>, <Money value={budget - projected} /> por debajo. Vas bien.
            </span>
          )}
        </div>
      ) : null}

      {!isCurrent && budget && spent <= budget && spent > 0 ? (
        <div className="note good celebrate" style={{ marginTop: 18 }}>
          <span style={{ fontSize: 22, letterSpacing: 0 }}>🎯</span>
          <span>
            Cerraste {monthLabel(month, locale).toLowerCase()} <b><Money value={budget - spent} /></b> por debajo del presupuesto.
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
  '🛒', '🍔', '☕', '🍺', '🍕', '🥗', '🚗', '⛽', '🚌', '🏍️', '🏠', '💡', '📱', '💻', '🛍️', '👕',
  '💪', '🏋️', '💊', '🩺', '🎬', '🎮', '🎵', '✈️', '🏖️', '📚', '🎓', '🎁', '🐶', '👶', '💇', '🧾',
  '💳', '🏦', '💼', '💸', '📈', '🪙', '🎉', '🛠️', '❤️', '💍', '🧴', '🧹', '📦', '🌱', '⚽', '🍷',
]

export function CategoryEditSheet({ id, kind: presetKind }: { id?: string; kind?: 'expense' | 'income' }) {
  const existing = useStore((s) => (id ? s.categories.find((c) => c.id === id) : undefined))
  const count = useStore((s) => (id ? s.transactions.filter((t) => t.categoryId === id).length : 0))
  const { upsertCategory, deleteCategory } = useStore.getState()
  const { closeSheet, closeAll } = useUI.getState()

  const [kind, setKind] = useState<'expense' | 'income'>(existing?.kind ?? presetKind ?? 'expense')
  const [emoji, setEmoji] = useState(existing?.emoji ?? '🧾')
  const [pickEmoji, setPickEmoji] = useState(!existing)
  const [name, setName] = useState(existing?.name ?? '')
  const [budget, setBudget] = useState<number | null>(existing?.budget ?? null)

  const canSave = name.trim().length > 0
  const isFallback = id === FALLBACK_CATEGORY.expense || id === FALLBACK_CATEGORY.income

  const save = () => {
    if (!canSave) return
    const c: Category = {
      id: existing?.id ?? uid(),
      name: name.trim(),
      emoji,
      color: existing?.color ?? '#4CA626',
      kind,
      budget: kind === 'expense' && budget ? budget : null,
    }
    upsertCategory(c)
    toast(existing ? 'Categoría actualizada' : 'Categoría creada')
    closeSheet()
  }

  const remove = () => {
    if (!existing) return
    const msg = count
      ? `Sus ${count} movimientos pasan a "${kind === 'income' ? 'Otros ingresos' : 'Otros'}". ¿Borrar ${existing.name}?`
      : `¿Borrar ${existing.name}?`
    if (!confirm(msg)) return
    deleteCategory(existing.id)
    toast('Categoría borrada')
    closeAll()
  }

  return (
    <Sheet
      title={existing ? 'Editar categoría' : 'Nueva categoría'}
      footer={
        <button className="save-bar" onClick={save} disabled={!canSave}>
          Guardar
        </button>
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
        className="big-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nombre de la categoría"
        aria-label="Nombre de la categoría"
        style={{ marginTop: 8 }}
      />

      {kind === 'expense' && (
        <>
          <AmountField value={budget} onChange={setBudget} variant="big" placeholder="0" ariaLabel="Presupuesto mensual" />
          <p className="caption" style={{ textAlign: 'center', margin: '6px 0 0' }}>
            Presupuesto mensual. Déjalo en 0 si no quieres límite.
          </p>
        </>
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
