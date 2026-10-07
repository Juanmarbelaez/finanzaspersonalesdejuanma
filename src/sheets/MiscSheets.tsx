import { Check } from 'lucide-react'
import { NO_FILTERS, useStore, useUI, type TxFilters } from '../store'
import { useLocale } from '../hooks'
import { addMonths, currentMonth, monthLabel } from '../lib/dates'
import { Sheet } from '../components/Sheet'
import { AccountCard, CatPill, Segmented, Toggle } from '../components/ui'

export function FiltersSheet() {
  const filters = useUI((s) => s.filters)
  const { setFilters, closeSheet } = useUI.getState()
  const categories = useStore((s) => s.categories)
  const accounts = useStore((s) => s.accounts)
  const toReview = useStore((s) => s.transactions.reduce((n, t) => n + (t.reviewed ? 0 : 1), 0))

  return (
    <Sheet
      title="Filtros"
      footer={
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn outline" style={{ flex: 1 }} onClick={() => setFilters(NO_FILTERS)}>
            Limpiar
          </button>
          <button className="btn primary" style={{ flex: 2 }} onClick={closeSheet}>
            Ver resultados
          </button>
        </div>
      }
    >
      <Segmented<TxFilters['type']>
        value={filters.type}
        onChange={(type) => setFilters({ type })}
        options={[
          { value: 'all', label: 'Todos' },
          { value: 'expense', label: 'Gastos' },
          { value: 'income', label: 'Ingresos' },
          { value: 'transfer', label: 'Transf.' },
        ]}
      />

      <div className="list-group" style={{ marginTop: 16 }}>
        <div className="kv">
          <span className="k">Solo por revisar {toReview > 0 && `(${toReview})`}</span>
          <Toggle on={filters.review} onChange={(review) => setFilters({ review })} label="Solo por revisar" />
        </div>
      </div>

      <div className="eyebrow gray group-title">Categoría</div>
      <div className="picker-grid">
        {categories.map((c) => (
          <CatPill
            key={c.id}
            category={c}
            selected={filters.categoryId === c.id}
            onClick={() => setFilters({ categoryId: filters.categoryId === c.id ? null : c.id })}
          />
        ))}
      </div>

      <div className="eyebrow gray group-title">Cuenta</div>
      <div className="acct-scroll">
        {accounts.map((a) => (
          <AccountCard
            key={a.id}
            account={a}
            selected={filters.accountId === a.id}
            onClick={() => setFilters({ accountId: filters.accountId === a.id ? null : a.id })}
          />
        ))}
      </div>
    </Sheet>
  )
}

export function MonthSheet() {
  const month = useUI((s) => s.month)
  const { setMonth, closeSheet } = useUI.getState()
  const transactions = useStore((s) => s.transactions)
  const locale = useLocale()
  const oldest = transactions.reduce((m, t) => (t.date.slice(0, 7) < m ? t.date.slice(0, 7) : m), currentMonth())
  const months: string[] = []
  for (let m = currentMonth(); m >= oldest && months.length < 60; m = addMonths(m, -1)) months.push(m)
  if (months.length < 2) months.push(addMonths(currentMonth(), -1))

  return (
    <Sheet title="Elige un mes">
      <div className="list-group">
        {months.map((m) => (
          <button
            key={m}
            className="item"
            onClick={() => {
              setMonth(m)
              closeSheet()
            }}
            style={m === month ? { color: 'var(--accent-ink)' } : undefined}
          >
            <span>{monthLabel(m, locale)}</span>
            {m === month && <Check size={18} />}
          </button>
        ))}
      </div>
    </Sheet>
  )
}
