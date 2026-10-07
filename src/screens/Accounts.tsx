import { useMemo, useState } from 'react'
import { useStore, useUI } from '../store'
import { useCountUp, useLocale } from '../hooks'
import { currentMonth, shortDate, todayISO } from '../lib/dates'
import { accountBalances, accountMonthChange, balanceSeries } from '../lib/selectors'
import type { Account } from '../lib/types'
import { TrendLine } from '../components/charts'
import { AccountCard, Delta, Money, Periods } from '../components/ui'

type Range = '30' | '90' | '180' | '365'

const GROUPS: { title: string; types: Account['type'][]; add: Account['type'] }[] = [
  { title: 'Tarjetas de crédito', types: ['credit'], add: 'credit' },
  { title: 'Cuentas', types: ['bank', 'savings'], add: 'bank' },
  { title: 'Efectivo', types: ['cash'], add: 'cash' },
  { title: 'Inversiones', types: ['investment'], add: 'investment' },
]

export function Accounts() {
  const accounts = useStore((s) => s.accounts)
  const transactions = useStore((s) => s.transactions)
  const openSheet = useUI((s) => s.openSheet)
  const locale = useLocale()
  const [range, setRange] = useState<Range>('90')
  const today = todayISO()
  const month = currentMonth()

  const balances = useMemo(() => accountBalances(accounts, transactions), [accounts, transactions])
  const series = useMemo(() => balanceSeries(accounts, transactions, Number(range), today), [accounts, transactions, range, today])
  const net = [...balances.values()].reduce((s, v) => s + v, 0)
  const assets = [...balances.values()].filter((v) => v > 0).reduce((s, v) => s + v, 0)
  const debts = [...balances.values()].filter((v) => v < 0).reduce((s, v) => s + v, 0)
  const hero = useCountUp(net)

  return (
    <div className="screen">
      <section className="card center">
        <div className="eyebrow gray">Patrimonio neto</div>
        <div className={`display num ${net < 0 ? 'neg' : ''}`} style={{ margin: '10px 0 6px' }}>
          <Money value={hero} />
        </div>
        <Delta current={net} previous={series[0]?.value ?? 0} />
        <div style={{ marginTop: 16 }}>
          <TrendLine values={series.map((p) => p.value)} labels={series.map((p) => shortDate(p.date, locale))} height={120} />
        </div>
        <Periods<Range>
          value={range}
          onChange={setRange}
          options={[
            { value: '30', label: '1M' },
            { value: '90', label: '3M' },
            { value: '180', label: '6M' },
            { value: '365', label: '1A' },
          ]}
        />
        <div className="legend-row" style={{ marginTop: 18, textAlign: 'left' }}>
          <div>
            <div className="caption">Tienes</div>
            <div className="v">
              <Money value={assets} />
            </div>
          </div>
          <div>
            <div className="caption">Debes</div>
            <div className={`v ${debts < 0 ? 'neg' : ''}`}>
              <Money value={Math.abs(debts)} />
            </div>
          </div>
        </div>
      </section>

      {GROUPS.map((g) => {
        const list = accounts.filter((a) => g.types.includes(a.type))
        const total = list.reduce((s, a) => s + (balances.get(a.id) ?? 0), 0)
        return (
          <section key={g.title}>
            <div className="group-head">
              <h3>{g.title}</h3>
              <span className="tot num">
                <Money value={total} />
              </span>
              <button className="add" onClick={() => openSheet({ name: 'accountEdit', type: g.add })}>
                Agregar ›
              </button>
            </div>
            {list.length ? (
              list.map((a) => {
                const bal = balances.get(a.id) ?? 0
                const change = accountMonthChange(transactions, a.id, month)
                return (
                  <button key={a.id} className="acct-row" onClick={() => openSheet({ name: 'account', id: a.id })}>
                    <AccountCard account={a} />
                    <div>
                      <div className="eyebrow gray">{a.type === 'credit' ? 'Deuda' : 'Saldo'}</div>
                      <div className={`v num ${bal < 0 && a.type !== 'credit' ? 'neg' : ''}`}>
                        <Money value={a.type === 'credit' ? Math.abs(bal) : bal} />
                      </div>
                    </div>
                    <div>
                      <div className="eyebrow gray">Este mes</div>
                      <div className={`v num ${change > 0 ? 'pos' : change < 0 ? 'neg' : 'muted'}`}>
                        <Money value={change} sign />
                      </div>
                    </div>
                  </button>
                )
              })
            ) : (
              <button className="empty-slot" onClick={() => openSheet({ name: 'accountEdit', type: g.add })}>
                Agregar {g.title.toLowerCase()}
              </button>
            )}
          </section>
        )
      })}
    </div>
  )
}
