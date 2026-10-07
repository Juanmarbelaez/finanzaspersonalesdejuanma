import { Fragment, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { NO_FILTERS, useStore, useUI } from '../store'
import { useAccountMap, useCategoryMap, useLocale } from '../hooks'
import { dayLabel, monthKey, monthLabel } from '../lib/dates'
import { normalizeMerchant } from '../lib/rules'
import { TxRow } from '../components/TxRow'
import { Empty, Money } from '../components/ui'
import { ArtCheck, ArtReceipt } from '../components/Art'

const PAGE = 120

export function Transactions() {
  const transactions = useStore((s) => s.transactions)
  const filters = useUI((s) => s.filters)
  const setFilters = useUI((s) => s.setFilters)
  const openSheet = useUI((s) => s.openSheet)
  const cats = useCategoryMap()
  const accounts = useAccountMap()
  const locale = useLocale()
  const [query, setQuery] = useState('')
  const q = normalizeMerchant(useDeferredValue(query))
  const [limit, setLimit] = useState(PAGE)
  const sentinel = useRef<HTMLDivElement>(null)

  const list = useMemo(() => {
    const out = transactions.filter((t) => {
      if (filters.review && t.reviewed) return false
      if (filters.type !== 'all' && t.type !== filters.type) return false
      if (filters.categoryId && t.categoryId !== filters.categoryId) return false
      if (filters.accountId && t.accountId !== filters.accountId && t.toAccountId !== filters.accountId) return false
      if (q) {
        const hay = normalizeMerchant(`${t.name} ${t.note ?? ''} ${cats.get(t.categoryId ?? '')?.name ?? ''} ${t.amount}`)
        if (!hay.includes(q)) return false
      }
      return true
    })
    return out.sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))
  }, [transactions, filters, q, cats])

  // Totales de gasto por mes para el encabezado de cada mes
  const monthSpend = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of list) if (t.type === 'expense') m.set(monthKey(t.date), (m.get(monthKey(t.date)) ?? 0) + t.amount)
    return m
  }, [list])

  useEffect(() => setLimit(PAGE), [filters, q])

  // Carga por partes: pinta 120 filas y agrega más al acercarse al final
  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver((e) => e[0].isIntersecting && setLimit((l) => l + PAGE), { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [list.length])

  const shown = list.slice(0, limit)
  const chips: { label: string; clear(): void }[] = []
  if (filters.review) chips.push({ label: 'Por revisar', clear: () => setFilters({ review: false }) })
  if (filters.type !== 'all')
    chips.push({ label: { expense: 'Gastos', income: 'Ingresos', transfer: 'Transferencias' }[filters.type], clear: () => setFilters({ type: 'all' }) })
  if (filters.categoryId) chips.push({ label: cats.get(filters.categoryId)?.name ?? 'Categoría', clear: () => setFilters({ categoryId: null }) })
  if (filters.accountId) chips.push({ label: accounts.get(filters.accountId)?.name ?? 'Cuenta', clear: () => setFilters({ accountId: null }) })

  let lastMonth = ''
  let lastDay = ''

  return (
    <div className="screen">
      <label className="search">
        <Search size={18} />
        {chips.map((c) => (
          <span key={c.label} className="filter-chip">
            {c.label}
            <button onClick={c.clear} aria-label={`Quitar filtro ${c.label}`} style={{ display: 'grid' }}>
              <X size={13} />
            </button>
          </span>
        ))}
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar" enterKeyHint="search" aria-label="Buscar movimientos" />
        {query ? (
          <button onClick={() => setQuery('')} aria-label="Borrar búsqueda">
            <X size={18} />
          </button>
        ) : (
          <button onClick={() => openSheet({ name: 'filters' })} aria-label="Filtros">
            <SlidersHorizontal size={18} />
          </button>
        )}
      </label>

      {shown.length === 0 ? (
        filters.review ? (
          <Empty art={<ArtCheck />} title="Todo revisado" text="Lo que importes o se cobre solo (recurrentes) aparece aquí para que lo confirmes." />
        ) : q || chips.length ? (
          <Empty art={<ArtReceipt />} title="Nada por aquí" text="No hay movimientos con esa búsqueda o filtro.">
            <button className="btn small" onClick={() => (setQuery(''), setFilters(NO_FILTERS))}>
              Limpiar filtros
            </button>
          </Empty>
        ) : (
          <Empty art={<ArtReceipt />} title="Tu primer movimiento" text="Registra un gasto con el botón + o importa el extracto de tu banco en CSV.">
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button className="btn primary small" onClick={() => openSheet({ name: 'tx' })}>
                Agregar
              </button>
              <button className="btn small" onClick={() => openSheet({ name: 'import' })}>
                Importar CSV
              </button>
            </div>
          </Empty>
        )
      ) : (
        <div>
          {shown.map((t) => {
            const m = monthKey(t.date)
            const newMonth = m !== lastMonth
            const newDay = t.date !== lastDay
            lastMonth = m
            lastDay = t.date
            return (
              <Fragment key={t.id}>
                {newMonth && (
                  <div className="month-head">
                    <h2 className="section-title">{monthLabel(m, locale)}</h2>
                    <Money value={monthSpend.get(m) ?? 0} className="caption" />
                  </div>
                )}
                {newDay && <div className="day-head eyebrow gray">{dayLabel(t.date, locale)}</div>}
                <TxRow tx={t} />
              </Fragment>
            )
          })}
          {shown.length < list.length && <div ref={sentinel} style={{ height: 1 }} />}
        </div>
      )}
    </div>
  )
}
