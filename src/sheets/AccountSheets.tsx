import { useMemo, useState } from 'react'
import { useStore, useUI } from '../store'
import { useLocale, toast } from '../hooks'
import { shortDate, todayISO } from '../lib/dates'
import { accountBalances, balanceSeries } from '../lib/selectors'
import { ACCOUNT_COLORS } from '../lib/seed'
import { uid } from '../lib/id'
import type { Account } from '../lib/types'
import { Sheet } from '../components/Sheet'
import { AmountDisplay, Keypad, useAmount } from '../components/Keypad'
import { haptic } from '../lib/haptic'
import { TrendLine } from '../components/charts'
import { TxRow } from '../components/TxRow'
import { ACCOUNT_TYPE_LABEL, AccountCard, Money, Segmented } from '../components/ui'
import { ask } from '../components/Dialog'

/* ---------------- Detalle ---------------- */

export function AccountSheet({ id }: { id: string }) {
  const account = useStore((s) => s.accounts.find((a) => a.id === id))
  const accounts = useStore((s) => s.accounts)
  const transactions = useStore((s) => s.transactions)
  const { openSheet, closeAll, setFilters, setTab } = useUI.getState()
  const locale = useLocale()
  const today = todayISO()

  const balance = useMemo(() => accountBalances(accounts, transactions).get(id) ?? 0, [accounts, transactions, id])
  const series = useMemo(() => balanceSeries(accounts, transactions, 90, today, id), [accounts, transactions, today, id])
  const recent = useMemo(
    () =>
      transactions
        .filter((t) => t.accountId === id || t.toAccountId === id)
        .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))
        .slice(0, 20),
    [transactions, id],
  )

  if (!account) return null
  const isCredit = account.type === 'credit'

  return (
    <Sheet
      title={ACCOUNT_TYPE_LABEL[account.type]}
      footer={
        <div className="action-bar">
          <button onClick={() => openSheet({ name: 'accountEdit', id })}>Editar</button>
          <button
            onClick={() => {
              setFilters({ accountId: id })
              setTab('transactions')
              closeAll()
            }}
          >
            Ver movimientos
          </button>
        </div>
      }
    >
      <div style={{ display: 'grid', placeItems: 'center', marginTop: 4 }}>
        <AccountCard account={account} big />
      </div>
      <h2 className="section-title" style={{ textAlign: 'center', marginTop: 16 }}>
        {account.name}
      </h2>
      <div className="eyebrow gray" style={{ textAlign: 'center', marginTop: 14 }}>
        {isCredit ? 'Deuda actual' : 'Saldo'}
      </div>
      <div className={`display num ${!isCredit && balance < 0 ? 'neg' : ''}`} style={{ textAlign: 'center', marginTop: 6 }}>
        <Money value={isCredit ? Math.abs(balance) : balance} />
      </div>

      <div style={{ marginTop: 18 }}>
        <TrendLine
          values={series.map((p) => (isCredit ? -p.value : p.value))}
          labels={series.map((p) => shortDate(p.date, locale))}
          height={100}
        />
      </div>
      {isCredit && (
        <p className="caption" style={{ textAlign: 'center', margin: '6px 0 0' }}>
          Para pagarla, registra una transferencia desde tu cuenta hacia la tarjeta.
        </p>
      )}

      <div className="eyebrow" style={{ marginTop: 22 }}>
        Últimos movimientos
      </div>
      {recent.length ? recent.map((t) => <TxRow key={t.id} tx={t} />) : <p className="body">Todavía no hay movimientos en esta cuenta.</p>}
    </Sheet>
  )
}

/* ---------------- Crear / editar ---------------- */

export function AccountEditSheet({ id, type: presetType }: { id?: string; type?: Account['type'] }) {
  const existing = useStore((s) => (id ? s.accounts.find((a) => a.id === id) : undefined))
  const count = useStore((s) => (id ? s.transactions.filter((t) => t.accountId === id || t.toAccountId === id).length : 0))
  const { upsertAccount, deleteAccount } = useStore.getState()
  const { closeSheet, closeAll } = useUI.getState()

  const [type, setType] = useState<Account['type']>(existing?.type ?? presetType ?? 'bank')
  const [name, setName] = useState(existing?.name ?? '')
  const [color, setColor] = useState(existing?.color ?? ACCOUNT_COLORS[0])
  const isCredit = type === 'credit'
  // "Saldo de hoy" es el saldo real (inicial + movimientos), no el inicial.
  // Al guardar se ajusta el inicial para que el de hoy quede como lo escribiste.
  const moved = useMemo(() => {
    if (!existing) return 0
    const { transactions } = useStore.getState()
    return (accountBalances([existing], transactions).get(existing.id) ?? 0) - existing.startingBalance
  }, [existing])
  const current = existing ? existing.startingBalance + moved : 0
  // En tarjetas se escribe la deuda en positivo y se guarda en negativo
  const [shown] = useState(() => Math.abs(current))
  const balance = useAmount(shown || null)
  const [pad, setPad] = useState(false)
  const [error, setError] = useState<{ msg: string; n: number } | null>(null)

  const save = () => {
    if (!name.trim()) {
      haptic()
      setPad(false)
      return setError((e) => ({ msg: 'Ponle un nombre a la cuenta', n: (e?.n ?? 0) + 1 }))
    }
    haptic()
    const amount = balance.value ?? 0
    const today = isCredit ? -amount : amount
    // Si no tocaste el saldo, el inicial queda igual (también si estaba en sobregiro)
    const untouched = existing && amount === shown && (existing.type === 'credit') === isCredit
    upsertAccount({
      id: existing?.id ?? uid(),
      name: name.trim(),
      type,
      color,
      startingBalance: untouched ? existing.startingBalance : today - moved,
    })
    toast(existing ? 'Cuenta actualizada' : 'Cuenta creada')
    closeSheet()
  }

  // Con movimientos se confirma (se van con ella); igual queda "Deshacer" unos segundos
  const remove = async () => {
    if (!existing) return
    if (
      count &&
      !(await ask({
        title: `¿Borrar ${existing.name}?`,
        message: `Se van también sus ${count} movimientos.`,
        confirm: 'Borrar cuenta y movimientos',
        destructive: true,
      }))
    )
      return
    const undo = deleteAccount(existing.id)
    closeAll()
    toast('Cuenta borrada', { label: 'Deshacer', run: undo })
  }

  return (
    <Sheet
      title={existing ? 'Editar cuenta' : 'Nueva cuenta'}
      footer={
        <>
          {pad && <Keypad onKey={balance.press} decimals={balance.decimals} decimalSep={balance.decimalSep} />}
          <button className="save-bar" onClick={save}>
            Guardar
          </button>
        </>
      }
      footerBar
    >
      <div style={{ display: 'grid', placeItems: 'center', marginTop: 4 }}>
        <AccountCard account={{ name: name || 'Mi cuenta', color, type }} big />
      </div>

      <input
        key={error?.n}
        className={`big-input ${error ? 'shake' : ''}`}
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          setError(null)
        }}
        onFocus={() => setPad(false)}
        placeholder="Nombre de la cuenta"
        aria-label="Nombre de la cuenta"
        style={{ marginTop: 16 }}
      />
      {error && (
        <p className="caption neg" style={{ textAlign: 'center', margin: '2px 0 0' }}>
          {error.msg}
        </p>
      )}

      <div style={{ textAlign: 'center', marginTop: 10 }}>
        <div className="eyebrow gray">{isCredit ? 'Deuda de hoy' : 'Saldo de hoy'}</div>
        <AmountDisplay
          display={balance.display}
          empty={balance.empty}
          active={pad}
          onActivate={() => setPad(true)}
          label={isCredit ? 'Deuda actual' : 'Saldo actual'}
        />
        <p className="caption" style={{ margin: '4px 0 0' }}>
          {existing && moved !== 0
            ? 'Con todos tus movimientos. Si no cuadra con el banco, escribe el real y la app ajusta.'
            : 'Desde aquí la app suma y resta tus movimientos.'}
        </p>
      </div>

      <div className="swatches" style={{ marginTop: 22 }}>
        {ACCOUNT_COLORS.map((c) => (
          <button
            key={c}
            className={c === color ? 'active' : ''}
            style={{ background: c }}
            onClick={() => {
              haptic()
              setColor(c)
            }}
            aria-label={`Color ${c}`}
          />
        ))}
      </div>

      <div style={{ marginTop: 22 }}>
        <Segmented
          value={type === 'savings' ? 'bank' : type}
          onChange={(t) => setType(t)}
          options={[
            { value: 'bank', label: 'Banco' },
            { value: 'cash', label: 'Efectivo' },
            { value: 'credit', label: 'Tarjeta' },
            { value: 'investment', label: 'Inversión' },
          ]}
        />
      </div>

      {existing && (
        <button className="btn ghost-danger block" style={{ marginTop: 28 }} onClick={remove}>
          Borrar cuenta
        </button>
      )}
    </Sheet>
  )
}
