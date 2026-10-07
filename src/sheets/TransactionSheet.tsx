import { useMemo, useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import { useStore, useUI, type TxInput } from '../store'
import type { TxType } from '../lib/types'
import { addDays, monthKey, parseISO, shortDate, todayISO } from '../lib/dates'
import { suggestCategory } from '../lib/rules'
import { frequentMerchants, topCategories } from '../lib/suggest'
import { FALLBACK_CATEGORY } from '../lib/seed'
import { haptic } from '../lib/haptic'
import { Sheet } from '../components/Sheet'
import { AmountDisplay, Keypad, useAmount } from '../components/Keypad'
import { AccountCard, CatPill, Money, Segmented } from '../components/ui'
import { toast, useLocale } from '../hooks'

export function TransactionSheet({ id, preset }: { id?: string; preset?: Partial<TxInput> }) {
  const { closeSheet: close, openSheet } = useUI.getState()
  const existing = useStore((s) => (id ? s.transactions.find((t) => t.id === id) : undefined))
  const transactions = useStore((s) => s.transactions)
  const categories = useStore((s) => s.categories)
  const accounts = useStore((s) => s.accounts)
  const rules = useStore((s) => s.merchantRules)
  const { addTransaction, updateTransaction, deleteTransaction, restoreTransactions } = useStore.getState()
  const locale = useLocale()
  const today = todayISO()

  const base = existing ?? preset
  // Valores por defecto: hoy, la última cuenta usada, la categoría del comercio
  const lastAccount = transactions.find((t) => t.type !== 'transfer')?.accountId
  const [type, setType] = useState<TxType>(base?.type ?? 'expense')
  const amount = useAmount(base?.amount ?? null)
  const [pad, setPad] = useState(!existing)
  const [name, setName] = useState(base?.name ?? '')
  const [categoryId, setCategoryId] = useState<string | null>(base?.categoryId ?? null)
  const [catTouched, setCatTouched] = useState(!!existing)
  const [allCats, setAllCats] = useState(false)
  const [accountId, setAccountId] = useState(base?.accountId ?? lastAccount ?? accounts[0]?.id ?? '')
  const [toAccountId, setToAccountId] = useState(
    base?.toAccountId ?? accounts.find((a) => a.id !== (base?.accountId ?? lastAccount))?.id ?? '',
  )
  const [date, setDate] = useState(base?.date ?? today)
  const [note, setNote] = useState(base?.note ?? '')
  const [showNote, setShowNote] = useState(!!base?.note)
  const [error, setError] = useState<{ msg: string; n: number } | null>(null)

  const kind = type === 'income' ? 'income' : 'expense'
  const isTransfer = type === 'transfer'
  const kindCats = categories.filter((c) => c.kind === kind)
  const validIds = useMemo(() => new Set(kindCats.map((c) => c.id)), [kindCats])
  const category = categories.find((c) => c.id === categoryId)

  const merchants = useMemo(
    () => (existing || isTransfer ? [] : frequentMerchants(transactions, type, today)),
    [transactions, type, today, existing, isTransfer],
  )
  // Menos decisiones: tus 6 categorías más usadas primero; el resto con "Más"
  const top = useMemo(() => {
    const ids = topCategories(transactions, kind, today)
    const list = ids.map((i) => kindCats.find((c) => c.id === i)).filter((c): c is NonNullable<typeof c> => !!c)
    for (const c of kindCats) if (list.length < 6 && !list.includes(c)) list.push(c)
    if (category && !list.includes(category)) list.unshift(category)
    return list
  }, [transactions, kind, today, kindCats, category])

  const onName = (v: string) => {
    setName(v)
    if (!catTouched) {
      const s = suggestCategory(v, rules, validIds)
      if (s) setCategoryId(s)
    }
  }

  // En cuanto corriges lo que faltaba, el error se va
  const press: typeof amount.press = (k) => {
    amount.press(k)
    setError(null)
  }

  const pickMerchant = (m: (typeof merchants)[number]) => {
    haptic()
    setError(null)
    setName(m.name)
    if (m.categoryId && validIds.has(m.categoryId)) setCategoryId(m.categoryId)
    if (accounts.some((a) => a.id === m.accountId)) setAccountId(m.accountId)
    // Si todavía no escribiste monto, propone el de la última vez (el tinto, el bus)
    if (amount.empty) amount.setRaw(String(m.lastAmount))
  }

  const onType = (t: TxType) => {
    setType(t)
    const k = t === 'income' ? 'income' : 'expense'
    if (category && category.kind !== k) {
      setCategoryId(null)
      setCatTouched(false)
    }
  }

  // Contexto mientras escribes: cómo queda el presupuesto de esa categoría con este gasto
  const context = useMemo(() => {
    if (type !== 'expense' || !category) return null
    const month = monthKey(date)
    const spent = transactions.reduce(
      (s, t) =>
        t.categoryId === category.id && t.type === 'expense' && monthKey(t.date) === month && t.id !== existing?.id ? s + t.amount : s,
      0,
    )
    const after = spent + (amount.value ?? 0)
    return { category, spent, after, budget: category.budget }
  }, [type, category, date, transactions, existing, amount.value])

  const fail = (msg: string) => {
    haptic()
    setError((e) => ({ msg, n: (e?.n ?? 0) + 1 }))
  }

  const save = () => {
    const value = amount.value
    // Si falta algo, el error dice qué hacer (el botón nunca queda gris)
    if (!value || value <= 0) {
      setPad(true)
      return fail(type === 'income' ? 'Escribe cuánto entró' : 'Escribe el monto')
    }
    if (!accountId) return fail('Elige una cuenta')
    if (isTransfer && (!toAccountId || toAccountId === accountId)) return fail('Elige a qué cuenta va la plata')
    haptic()
    const cat = isTransfer ? null : (categoryId ?? FALLBACK_CATEGORY[kind])
    const input: TxInput = {
      type,
      amount: value,
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

  // Borrar sin preguntar, con deshacer (como en iOS): menos fricción y nada se pierde por error
  const remove = () => {
    if (!existing) return
    deleteTransaction(existing.id)
    close()
    toast('Movimiento borrado', { label: 'Deshacer', run: () => restoreTransactions([existing]) })
  }

  const yesterday = addDays(today, -1)
  const rawDate = parseISO(date).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
  const title = existing ? (existing.recurringId ? 'Movimiento recurrente' : 'Movimiento') : 'Nuevo movimiento'

  return (
    <Sheet
      title={title}
      sub={existing ? rawDate.charAt(0).toUpperCase() + rawDate.slice(1) : undefined}
      footer={
        <>
          {pad && <Keypad onKey={press} decimals={amount.decimals} decimalSep={amount.decimalSep} />}
          <button className="save-bar" onClick={save}>
            {existing && !existing.reviewed ? 'Confirmar' : 'Guardar'}
          </button>
        </>
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

      <div style={{ marginTop: 18, textAlign: 'center' }}>
        <AmountDisplay
          display={amount.display}
          empty={amount.empty}
          active={pad}
          onActivate={() => setPad(true)}
          shake={error?.n}
          className={type === 'income' ? 'pos' : ''}
        />
        <div className="amount-context" aria-live="polite">
          {error ? (
            <span key={error.n} className="neg">
              {error.msg}
            </span>
          ) : context ? (
            context.budget ? (
              context.after > context.budget ? (
                <span className="warn-text">
                  Con esto te pasas <Money value={context.after - context.budget} /> en {context.category.name.toLowerCase()}
                </span>
              ) : (
                <span>
                  Te quedan <Money value={context.budget - context.after} /> en {context.category.name.toLowerCase()}
                </span>
              )
            ) : (
              <span>
                Llevas <Money value={context.after} /> en {context.category.name.toLowerCase()} este mes
              </span>
            )
          ) : null}
        </div>
      </div>

      {!isTransfer && (
        <>
          <input
            className="name-input"
            value={name}
            onChange={(e) => onName(e.target.value)}
            onFocus={() => setPad(false)}
            placeholder={type === 'income' ? '¿De dónde entró?' : '¿En qué? (opcional)'}
            aria-label="Nombre del movimiento"
            autoComplete="off"
            enterKeyHint="done"
          />
          {merchants.length > 0 && (
            <div className="suggest">
              {merchants.map((m) => (
                <button key={m.name} className={name === m.name ? 'on' : ''} onClick={() => pickMerchant(m)}>
                  {categories.find((c) => c.id === m.categoryId)?.emoji} {m.name}
                </button>
              ))}
            </div>
          )}

          <div className="picker-grid" style={{ marginTop: 14 }}>
            {(allCats ? kindCats : top).map((c) => (
              <CatPill
                key={c.id}
                category={c}
                selected={categoryId === c.id}
                onClick={() => {
                  haptic()
                  setCategoryId(c.id)
                  setCatTouched(true)
                }}
              />
            ))}
            {!allCats && kindCats.length > top.length && (
              <button type="button" className="cat-pill more" onClick={() => setAllCats(true)}>
                <span className="t">Más</span> <ChevronDown size={12} />
              </button>
            )}
          </div>
        </>
      )}

      <div className="eyebrow gray" style={{ textAlign: 'center', marginTop: 20 }}>
        {isTransfer ? 'Desde' : 'Cuenta'}
      </div>
      <div className="acct-scroll">
        {accounts.map((a) => (
          <AccountCard
            key={a.id}
            account={a}
            selected={accountId === a.id}
            onClick={() => {
              haptic()
              setError(null)
              setAccountId(a.id)
            }}
          />
        ))}
      </div>

      {isTransfer && (
        <>
          <div className="eyebrow gray" style={{ textAlign: 'center', marginTop: 8 }}>
            Hacia
          </div>
          <div className="acct-scroll">
            {accounts
              .filter((a) => a.id !== accountId)
              .map((a) => (
                <AccountCard
                  key={a.id}
                  account={a}
                  selected={toAccountId === a.id}
                  onClick={() => {
                    haptic()
                    setError(null)
                    setToAccountId(a.id)
                  }}
                />
              ))}
          </div>
          <p className="caption" style={{ textAlign: 'center', margin: '4px 0 0' }}>
            Para pagar la tarjeta o mover plata entre cuentas. No cuenta como gasto.
          </p>
        </>
      )}

      <div className="chip-row" style={{ marginTop: 14 }}>
        <button type="button" className={date === today ? 'on' : ''} onClick={() => setDate(today)}>
          Hoy
        </button>
        <button type="button" className={date === yesterday ? 'on' : ''} onClick={() => setDate(yesterday)}>
          Ayer
        </button>
        <label className={date !== today && date !== yesterday ? 'on' : ''}>
          {date !== today && date !== yesterday ? shortDate(date, locale) : 'Otra fecha'}
          <input
            type="date"
            value={date}
            max="2100-12-31"
            onChange={(e) => e.target.value && setDate(e.target.value)}
            aria-label="Elegir fecha"
          />
        </label>
        {!showNote && (
          <button type="button" onClick={() => setShowNote(true)}>
            <Plus size={13} /> Nota
          </button>
        )}
      </div>

      {showNote && (
        <div className="list-group" style={{ marginTop: 12 }}>
          <div className="kv">
            <span className="k">Nota</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onFocus={() => setPad(false)}
              placeholder="Agregar nota"
              aria-label="Nota"
              autoFocus={!base?.note}
            />
          </div>
        </div>
      )}

      {existing && (
        <div className="action-bar" style={{ marginTop: 22 }}>
          {!existing.recurringId && existing.type !== 'transfer' && (
            <button onClick={() => openSheet({ name: 'recurringEdit', fromTx: existing.id })}>Hacer recurrente</button>
          )}
          {existing.recurringId && (
            <button onClick={() => openSheet({ name: 'recurring', id: existing.recurringId! })}>Ver recurrente</button>
          )}
          <button onClick={() => openSheet({ name: 'tx', preset: { ...existing, date: today, recurringId: undefined } })}>
            Repetir hoy
          </button>
          <button className="danger" onClick={remove}>
            Borrar
          </button>
        </div>
      )}
    </Sheet>
  )
}
