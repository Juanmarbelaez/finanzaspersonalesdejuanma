import { memo } from 'react'
import type { Transaction } from '../lib/types'
import { useCategoryMap } from '../hooks'
import { useUI } from '../store'
import { CatPill, Money } from './ui'

/** Fila mínima como en Copilot: nombre · etiqueta · monto · punto si falta revisar. */
export const TxRow = memo(function TxRow({ tx }: { tx: Transaction }) {
  const cats = useCategoryMap()
  const openSheet = useUI((s) => s.openSheet)
  const cat = tx.categoryId ? cats.get(tx.categoryId) : undefined
  const isTransfer = tx.type === 'transfer'
  // Recién guardada: destello de confirmación, además del toast
  const fresh = Date.now() - tx.createdAt < 4000

  return (
    <button className={`tx-row ${fresh ? 'fresh' : ''}`} onClick={() => openSheet({ name: 'tx', id: tx.id })}>
      <span className="name">
        {tx.recurringId && <i className="badge">R</i>}
        {isTransfer && <i className="badge">T</i>}
        <span>{tx.name || cat?.name || 'Movimiento'}</span>
      </span>
      {isTransfer ? <span /> : <CatPill category={cat} />}
      <span className={`amt ${tx.type === 'income' ? 'pos' : isTransfer ? 'muted' : ''}`}>
        <Money value={tx.amount} sign={tx.type === 'income'} />
      </span>
      {tx.reviewed ? <span /> : <span className="dot" aria-label="Por revisar" />}
    </button>
  )
})
