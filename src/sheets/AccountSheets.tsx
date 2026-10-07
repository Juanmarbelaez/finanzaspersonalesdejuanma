import { useMemo, useState } from 'react'
import { useStore, useUI } from '../store'
import { useLocale, toast } from '../hooks'
import { shortDate, todayISO } from '../lib/dates'
import { accountBalances, balanceSeries } from '../lib/selectors'
import { ACCOUNT_COLORS } from '../lib/seed'
import { uid } from '../lib/id'
import type { Account } from '../lib/types'
import { Sheet } from '../components/Sheet'
import { AmountField } from '../components/AmountField'
import { TrendLine } from '../components/charts'
import { TxRow } from '../components/TxRow'
import { ACCOUNT_TYPE_LABEL, AccountCard, Money, Segmented } from '../components/ui'

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
        <TrendLine values={series.map((p) => (isCredit ? -p.value : p.value))} labels={series.map((p) => shortDate(p.date, locale))} height={100} />
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
  // En tarjetas se escribe la deuda en positivo y se guarda en negativo
  const [balance, setBalance] = useState<number | null>(
    existing ? Math.abs(existing.startingBalance) || null : null,
  )

  const canSave = name.trim().length > 0

  const save = () => {
    if (!canSave) return
    const amount = balance ?? 0
    upsertAccount({
      id: existing?.id ?? uid(),
      name: name.trim(),
      type,
      color,
      startingBalance: isCredit ? -amount : amount,
    })
    toast(existing ? 'Cuenta actualizada' : 'Cuenta creada')
    closeSheet()
  }

  const remove = () => {
    if (!existing) return
    const msg = count
      ? `Se borran también sus ${count} movimientos. Esto no se puede deshacer. ¿Borrar ${existing.name}?`
      : `¿Borrar ${existing.name}?`
    if (!confirm(msg)) return
    deleteAccount(existing.id)
    toast('Cuenta borrada')
    closeAll()
  }

  return (
    <Sheet
      title={existing ? 'Editar cuenta' : 'Nueva cuenta'}
      footer={
        <button className="save-bar" onClick={save} disabled={!canSave}>
          Guardar
        </button>
      }
      footerBar
    >
      <div style={{ display: 'grid', placeItems: 'center', marginTop: 4 }}>
        <AccountCard account={{ name: name || 'Mi cuenta', color, type }} big />
      </div>

      <input
        className="big-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nombre de la cuenta"
        aria-label="Nombre de la cuenta"
        style={{ marginTop: 16 }}
      />

      <div className="eyebrow gray" style={{ textAlign: 'center', marginTop: 10 }}>
        {isCredit ? 'Deuda de hoy' : 'Saldo de hoy'}
      </div>
      <AmountField value={balance} onChange={setBalance} variant="big" ariaLabel={isCredit ? 'Deuda actual' : 'Saldo actual'} />
      <p className="caption" style={{ textAlign: 'center', margin: '6px 0 0' }}>
        Desde aquí la app suma y resta tus movimientos.
      </p>

      <div className="swatches" style={{ marginTop: 22 }}>
        {ACCOUNT_COLORS.map((c) => (
          <button key={c} className={c === color ? 'active' : ''} style={{ background: c }} onClick={() => setColor(c)} aria-label={`Color ${c}`} />
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
