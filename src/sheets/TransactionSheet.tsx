import { useMemo, useState } from 'react'
import { useStore, useUI, type TxInput } from '../store'
import type { TxType } from '../lib/types'
import { parseISO, todayISO } from '../lib/dates'
import { normalizeMerchant, suggestCategory } from '../lib/rules'
import { FALLBACK_CATEGORY } from '../lib/seed'
import { Sheet } from '../components/Sheet'
import { AmountField } from '../components/AmountField'
import { AccountCard, CatPill, Segmented } from '../components/ui'
import { toast, useLocale } from '../hooks'
import { haptic } from '../lib/haptic'

export function TransactionSheet({ id, preset }: { id?: string; preset?: Partial<TxInput> }) {
  const { closeSheet: close, openSheet } = useUI.getState()
  const existing = useStore((s) => (id ? s.transactions.find((t) => t.id === id) : undefined))
  const transactions = useStore((s) => s.transactions)
  const categories = useStore((s) => s.categories)
  const accounts = useStore((s) => s.accounts)
  const rules = useStore((s) => s.merchantRules)
  const { addTransaction, updateTransaction, deleteTransaction } = useStore.getState()
  const locale = useLocale()

  const base = existing ?? preset
  // Valores por defecto inteligentes: hoy, la última cuenta usada, la categoría del comercio
  const lastAccount = transactions.find((t) => t.type !== 'transfer')?.accountId
  const [type, setType] = useState<TxType>(base?.type ?? 'expense')
  const [amount, setAmount] = useState<number | null>(base?.amount ?? null)
  const [name, setName] = useState(base?.name ?? '')
  const [categoryId, setCategoryId] = useState<string | null>(base?.categoryId ?? null)
  const [catTouched, setCatTouched] = useState(!!existing)
  const [pickCat, setPickCat] = useState(!existing)
  const [accountId, setAccountId] = useState(base?.accountId ?? lastAccount ?? accounts[0]?.id ?? '')
  const [toAccountId, setToAccountId] = useState(base?.toAccountId ?? accounts.find((a) => a.id !== (base?.accountId ?? lastAccount))?.id ?? '')
  const [date, setDate] = useState(base?.date ?? todayISO())
  const [note, setNote] = useState(base?.note ?? '')

  const kind = type === 'income' ? 'income' : 'expense'
  const kindCats = categories.filter((c) => c.kind === kind)
  const validIds = useMemo(() => new Set(kindCats.map((c) => c.id)), [kindCats])
  const category = categories.find((c) => c.id === categoryId)

  const merchants = useMemo(() => {
    const freq = new Map<string, { label: string; n: number }>()
    for (const t of transactions) {
      if (t.type !== type || !t.name) continue
      const k = normalizeMerchant(t.name)
      const cur = freq.get(k)
      if (cur) cur.n++
      else freq.set(k, { label: t.name, n: 1 })
    }
    return [...freq.values()].sort((a, b) => b.n - a.n).map((m) => m.label)
  }, [transactions, type])

  const q = normalizeMerchant(name)
  const suggestions = existing
    ? []
    : merchants
        .filter((m) => {
          const n = normalizeMerchant(m)
          return n !== q && (!q || n.includes(q))
        })
        .slice(0, 6)

  const onName = (v: string) => {
    setName(v)
    if (!catTouched) {
      const s = suggestCategory(v, rules, validIds)
      if (s) {
        setCategoryId(s)
        setPickCat(false)
      }
    }
  }

  const onType = (t: TxType) => {
    setType(t)
    const k = t === 'income' ? 'income' : 'expense'
    if (category && category.kind !== k) {
      setCategoryId(null)
      setCatTouched(false)
      setPickCat(true)
    }
  }

  const isTransfer = type === 'transfer'
  const canSave = !!amount && amount > 0 && !!accountId && (!isTransfer || (!!toAccountId && toAccountId !== accountId))

  const save = () => {
    if (!canSave || !amount) return
    haptic()
    const cat = isTransfer ? null : (categoryId ?? FALLBACK_CATEGORY[kind])
    const input: TxInput = {
      type,
      amount,
      name: name.trim() || (isTransfer ? 'Transferencia' : (categories.find((c) => c.id === cat)?.name ?? '')),
      categoryId: cat,
      accountId,
      toAccountId: isTransfer ? toAccountId : undefined,
      date,
      note: note.trim() || undefined,
      recurringId: existing?.recurringId,
    }
    if (existing) {
      // Guardar un movimiento por revisar cuenta como revisarlo
      updateTransaction(existing.id, { ...input, reviewed: true })
      toast(existing.reviewed ? 'Cambios guardados' : 'Revisado')
    } else {
      addTransaction(input)
      toast(type === 'income' ? 'Ingreso guardado' : isTransfer ? 'Transferencia guardada' : 'Gasto guardado')
    }
    close()
  }

  const remove = () => {
    if (!existing || !confirm('¿Borrar este movimiento?')) return
    deleteTransaction(existing.id)
    toast('Movimiento borrado')
    close()
  }

  const rawDate = parseISO(date).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const dateLabel = rawDate.charAt(0).toUpperCase() + rawDate.slice(1)
  const title = existing ? (existing.recurringId ? 'Movimiento recurrente' : 'Movimiento') : 'Nuevo movimiento'

  return (
    <Sheet
      title={title}
      sub={
        <label style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }}>
          {dateLabel}
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            aria-label="Fecha"
            style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%' }}
          />
        </label>
      }
      footer={
        <button className="save-bar" onClick={save} disabled={!canSave}>
          {existing && !existing.reviewed ? 'Confirmar' : 'Guardar'}
        </button>
      }
      footerBar
    >
      <Segmented<TxType>
        value={type}
        onChange={onType}
        options={[
          { value: 'expense', label: 'Gasto' },
          { value: 'income', label: 'Ingreso' },
          { value: 'transfer', label: 'Transferencia' },
        ]}
      />

      <div style={{ marginTop: 20 }}>
        {!isTransfer && (
          <input
            className="big-input"
            value={name}
            onChange={(e) => onName(e.target.value)}
            placeholder={type === 'income' ? '¿De dónde entró?' : '¿En qué se fue?'}
            aria-label="Nombre del movimiento"
            autoComplete="off"
            enterKeyHint="next"
          />
        )}
        {suggestions.length > 0 && (
          <div className="suggest">
            {suggestions.map((s) => (
              <button key={s} onClick={() => onName(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        <AmountField value={amount} onChange={setAmount} autoFocus={!existing} variant="big" className={type === 'income' ? 'pos' : ''} />
      </div>

      {!isTransfer && (
        <div style={{ marginTop: 14, textAlign: 'center' }}>
          {pickCat ? (
            <div className="picker-grid">
              {kindCats.map((c) => (
                <CatPill
                  key={c.id}
                  category={c}
                  selected={categoryId === c.id}
                  onClick={() => {
                    setCategoryId(c.id)
                    setCatTouched(true)
                    setPickCat(false)
                  }}
                />
              ))}
            </div>
          ) : (
            <CatPill category={category} big onClick={() => setPickCat(true)} />
          )}
        </div>
      )}

      <div className="eyebrow gray" style={{ textAlign: 'center', marginTop: 22 }}>
        {isTransfer ? 'Desde' : 'Cuenta'}
      </div>
      <div className="acct-scroll">
        {accounts.map((a) => (
          <AccountCard key={a.id} account={a} selected={accountId === a.id} onClick={() => setAccountId(a.id)} />
        ))}
      </div>

      {isTransfer && (
        <>
          <div className="eyebrow gray" style={{ textAlign: 'center', marginTop: 10 }}>
            Hacia
          </div>
          <div className="acct-scroll">
            {accounts
              .filter((a) => a.id !== accountId)
              .map((a) => (
                <AccountCard key={a.id} account={a} selected={toAccountId === a.id} onClick={() => setToAccountId(a.id)} />
              ))}
          </div>
          <p className="caption" style={{ textAlign: 'center', margin: '4px 0 0' }}>
            Para pagar la tarjeta o mover plata entre cuentas. No cuenta como gasto.
          </p>
        </>
      )}

      <div className="list-group" style={{ marginTop: 18 }}>
        <div className="kv">
          <span className="k">Nota</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Agregar nota" aria-label="Nota" />
        </div>
      </div>

      {existing && (
        <div className="action-bar" style={{ marginTop: 22 }}>
          {!existing.recurringId && existing.type !== 'transfer' && (
            <button onClick={() => openSheet({ name: 'recurringEdit', fromTx: existing.id })}>Hacer recurrente</button>
          )}
          {existing.recurringId && <button onClick={() => openSheet({ name: 'recurring', id: existing.recurringId! })}>Ver recurrente</button>}
          <button className="danger" onClick={remove}>
            Borrar
          </button>
        </div>
      )}
    </Sheet>
  )
}
