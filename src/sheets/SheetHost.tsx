import { createPortal } from 'react-dom'
import { useUI } from '../store'
import { SheetCtx, useSheetEffects } from '../components/Sheet'
import { TransactionSheet } from './TransactionSheet'
import { CategoriesManageSheet, CategoryEditSheet, CategorySheet } from './CategorySheets'
import { RecurringEditSheet, RecurringSheet } from './RecurringSheets'
import { AccountEditSheet, AccountSheet } from './AccountSheets'
import { FiltersSheet, MonthSheet } from './MiscSheets'
import { SettingsSheet } from './SettingsSheet'
import { ImportSheet } from './ImportSheet'
import { AuthSheet } from './AuthSheet'
import type { Sheet } from '../store'

function render(s: Sheet) {
  switch (s.name) {
    case 'tx':
      return <TransactionSheet id={s.id} preset={s.preset} />
    case 'category':
      return <CategorySheet id={s.id} />
    case 'categoryEdit':
      return <CategoryEditSheet id={s.id} kind={s.kind} />
    case 'categoriesManage':
      return <CategoriesManageSheet />
    case 'recurring':
      return <RecurringSheet id={s.id} />
    case 'recurringEdit':
      return <RecurringEditSheet id={s.id} fromTx={s.fromTx} />
    case 'account':
      return <AccountSheet id={s.id} />
    case 'accountEdit':
      return <AccountEditSheet id={s.id} type={s.type} />
    case 'filters':
      return <FiltersSheet />
    case 'month':
      return <MonthSheet />
    case 'settings':
      return <SettingsSheet />
    case 'import':
      return <ImportSheet />
    case 'auth':
      return <AuthSheet />
  }
}

/** Pinta las hojas apiladas: la de arriba tapa a la de abajo (detalle → editar). */
export function SheetHost() {
  const sheets = useUI((s) => s.sheets)
  const close = useUI((s) => s.closeSheet)
  useSheetEffects(
    sheets.some((s) => !s.closing),
    close,
  )

  // Fuera del contenedor de scroll: en iPhone, una hoja dentro de él puede quedar recortada abajo
  return createPortal(
    <>
      {sheets.map((s, i) => (
        <div key={s.key} style={{ position: 'relative', zIndex: 40 + i }}>
          <SheetCtx.Provider value={{ closing: !!s.closing, index: i }}>{render(s)}</SheetCtx.Provider>
        </div>
      ))}
    </>,
    document.body,
  )
}
