import { useMemo, useRef, useState } from 'react'
import { FileUp } from 'lucide-react'
import { useStore, useUI, type TxInput } from '../store'
import { toast } from '../hooks'
import { detectDateFormat, parseAmount, parseCSV, parseDate, type DateFormat } from '../lib/csv'
import { readFile } from '../lib/download'
import { suggestCategory } from '../lib/rules'
import { FALLBACK_CATEGORY } from '../lib/seed'
import { Sheet } from '../components/Sheet'
import { AccountCard, Money, Segmented, Toggle } from '../components/ui'

type AmountMode = 'single' | 'split'
type Sign = 'negExpense' | 'posExpense'

const guess = (headers: string[], words: string[]) =>
  headers.findIndex((h) => words.some((w) => h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(w)))

export function ImportSheet() {
  const accounts = useStore((s) => s.accounts)
  const categories = useStore((s) => s.categories)
  const rules = useStore((s) => s.merchantRules)
  const importTransactions = useStore((s) => s.importTransactions)
  const { closeAll, setFilters, setTab } = useUI.getState()
  const fileRef = useRef<HTMLInputElement>(null)

  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<string[][]>([])
  const [hasHeader, setHasHeader] = useState(true)
  const [dateCol, setDateCol] = useState(0)
  const [descCol, setDescCol] = useState(1)
  const [amountCol, setAmountCol] = useState(2)
  const [debitCol, setDebitCol] = useState(2)
  const [creditCol, setCreditCol] = useState(3)
  const [mode, setMode] = useState<AmountMode>('single')
  const [sign, setSign] = useState<Sign>('negExpense')
  const [dateFormat, setDateFormat] = useState<DateFormat>('dmy')
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')

  const onFile = async (file: File | undefined) => {
    if (!file) return
    if (/\.xlsx?$/i.test(file.name)) {
      alert('Ese archivo es de Excel. Ábrelo en Excel o Numbers y guárdalo como CSV (Archivo → Exportar → CSV), y lo vuelves a subir.')
      return
    }
    const text = await readFile(file)
    const parsed = parseCSV(text)
    if (parsed.length < 2) {
      alert('No encontré filas en ese archivo. Revisa que sea el extracto en CSV y que tenga al menos un movimiento.')
      return
    }
    setFileName(file.name)
    setRows(parsed)
    // Adivinar columnas por el encabezado (bancos colombianos y en inglés)
    const head = parsed[0]
    const d = guess(head, ['fecha', 'date'])
    const desc = guess(head, ['descrip', 'concepto', 'detalle', 'comercio', 'referencia', 'description', 'payee'])
    const amt = guess(head, ['valor', 'monto', 'importe', 'amount'])
    const deb = guess(head, ['debito', 'cargo', 'retiro', 'debit'])
    const cred = guess(head, ['credito', 'abono', 'deposito', 'credit'])
    const looksHeader = d >= 0 || desc >= 0 || amt >= 0
    setHasHeader(looksHeader)
    if (d >= 0) setDateCol(d)
    if (desc >= 0) setDescCol(desc)
    if (amt >= 0) {
      setAmountCol(amt)
      setMode('single')
    } else if (deb >= 0 && cred >= 0) {
      setDebitCol(deb)
      setCreditCol(cred)
      setMode('split')
    }
    const body = looksHeader ? parsed.slice(1) : parsed
    setDateFormat(detectDateFormat(body.slice(0, 30).map((r) => r[d >= 0 ? d : 0] ?? '')))
  }

  const headers = rows[0] ?? []
  const body = hasHeader ? rows.slice(1) : rows
  const colOptions = headers.map((h, i) => ({ i, label: hasHeader ? h || `Columna ${i + 1}` : `Columna ${i + 1} (${(h ?? '').slice(0, 14)})` }))

  const parsed = useMemo(() => {
    const expenseIds = new Set(categories.filter((c) => c.kind === 'expense').map((c) => c.id))
    const incomeIds = new Set(categories.filter((c) => c.kind === 'income').map((c) => c.id))
    const ok: TxInput[] = []
    const bad: { line: number; reason: string }[] = []
    body.forEach((r, idx) => {
      const line = idx + (hasHeader ? 2 : 1)
      const date = parseDate(r[dateCol] ?? '', dateFormat)
      if (!date) return bad.push({ line, reason: `fecha "${r[dateCol] ?? ''}" no se entiende` })
      let value: number | null
      if (mode === 'single') {
        const v = parseAmount(r[amountCol] ?? '')
        value = v === null ? null : sign === 'negExpense' ? v : -v
      } else {
        const deb = parseAmount(r[debitCol] ?? '') ?? 0
        const cred = parseAmount(r[creditCol] ?? '') ?? 0
        value = Math.abs(cred) - Math.abs(deb)
      }
      if (value === null || value === 0) return bad.push({ line, reason: `monto "${r[mode === 'single' ? amountCol : debitCol] ?? ''}" vacío o en cero` })
      const name = (r[descCol] ?? '').replace(/\s+/g, ' ').trim() || 'Movimiento'
      const type = value < 0 ? 'expense' : 'income'
      const cat = suggestCategory(name, rules, type === 'expense' ? expenseIds : incomeIds) ?? FALLBACK_CATEGORY[type]
      ok.push({ date, name, amount: Math.abs(value), type, categoryId: cat, accountId })
    })
    return { ok, bad }
  }, [body, hasHeader, dateCol, descCol, amountCol, debitCol, creditCol, mode, sign, dateFormat, accountId, categories, rules])

  const doImport = () => {
    const { added, skipped } = importTransactions(parsed.ok)
    toast(skipped ? `${added} nuevos · ${skipped} repetidos saltados` : `${added} movimientos importados`)
    setFilters({ review: true })
    setTab('transactions')
    closeAll()
  }

  const catName = (id: string | null) => categories.find((c) => c.id === id)

  return (
    <Sheet
      title="Importar extracto"
      full
      footer={
        rows.length ? (
          <button className="save-bar" onClick={doImport} disabled={!parsed.ok.length}>
            Importar {parsed.ok.length} movimientos
          </button>
        ) : undefined
      }
      footerBar
    >
      {!rows.length ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <p className="body">
            Descarga el extracto desde la app o web de tu banco en <b>CSV</b> y súbelo aquí. Los movimientos quedan <b>por revisar</b>, con categoría sugerida, y si
            importas el mismo extracto dos veces no se duplican.
          </p>
          <button className="btn primary" style={{ marginTop: 16 }} onClick={() => fileRef.current?.click()}>
            <FileUp size={18} /> Elegir archivo
          </button>
        </div>
      ) : (
        <>
          <div className="note" style={{ marginBottom: 14 }}>
            <span>
              <b>{fileName}</b> · {body.length} filas
            </span>
            <button className="caption" style={{ marginLeft: 'auto' }} onClick={() => fileRef.current?.click()}>
              Cambiar
            </button>
          </div>

          <div className="list-group">
            <div className="kv">
              <span className="k">La primera fila es el encabezado</span>
              <Toggle on={hasHeader} onChange={setHasHeader} label="Encabezado" />
            </div>
            <ColSelect label="Fecha" value={dateCol} onChange={setDateCol} options={colOptions} />
            <div className="kv">
              <span className="k">Formato de fecha</span>
              <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value as DateFormat)}>
                <option value="dmy">Día/Mes/Año</option>
                <option value="mdy">Mes/Día/Año</option>
                <option value="ymd">Año-Mes-Día</option>
              </select>
            </div>
            <ColSelect label="Descripción" value={descCol} onChange={setDescCol} options={colOptions} />
          </div>

          <div style={{ marginTop: 14 }}>
            <Segmented<AmountMode>
              value={mode}
              onChange={setMode}
              options={[
                { value: 'single', label: 'Una columna de monto' },
                { value: 'split', label: 'Débito y crédito' },
              ]}
            />
          </div>
          <div className="list-group" style={{ marginTop: 10 }}>
            {mode === 'single' ? (
              <>
                <ColSelect label="Monto" value={amountCol} onChange={setAmountCol} options={colOptions} />
                <div className="kv">
                  <span className="k">Los gastos vienen</span>
                  <select value={sign} onChange={(e) => setSign(e.target.value as Sign)}>
                    <option value="negExpense">En negativo (−)</option>
                    <option value="posExpense">En positivo</option>
                  </select>
                </div>
              </>
            ) : (
              <>
                <ColSelect label="Débito (sale)" value={debitCol} onChange={setDebitCol} options={colOptions} />
                <ColSelect label="Crédito (entra)" value={creditCol} onChange={setCreditCol} options={colOptions} />
              </>
            )}
          </div>

          <div className="eyebrow gray group-title">¿A qué cuenta?</div>
          <div className="acct-scroll">
            {accounts.map((a) => (
              <AccountCard key={a.id} account={a} selected={accountId === a.id} onClick={() => setAccountId(a.id)} />
            ))}
          </div>

          {parsed.bad.length > 0 && (
            <div className="note warn" style={{ marginTop: 14 }}>
              <span>
                <b>{parsed.bad.length} filas no se van a importar.</b> Ej: fila {parsed.bad[0].line}, {parsed.bad[0].reason}.{' '}
                {parsed.ok.length === 0
                  ? 'Revisa que las columnas de fecha y monto estén bien elegidas arriba.'
                  : 'Si son totales o filas de resumen del banco, está bien.'}
              </span>
            </div>
          )}

          <div className="eyebrow gray group-title">Vista previa</div>
          <table className="preview">
            <tbody>
              {parsed.ok.slice(0, 8).map((t, i) => (
                <tr key={i}>
                  <td className="caption">{t.date.slice(5).split('-').reverse().join('/')}</td>
                  <td>
                    <span style={{ letterSpacing: 0 }}>{catName(t.categoryId)?.emoji}</span> {t.name}
                  </td>
                  <td className={t.type === 'income' ? 'pos' : ''}>
                    <Money value={t.amount} sign={t.type === 'income'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <input ref={fileRef} type="file" accept=".csv,text/csv,.txt,.xls,.xlsx" hidden onChange={(e) => onFile(e.target.files?.[0])} />
    </Sheet>
  )
}

function ColSelect({ label, value, onChange, options }: { label: string; value: number; onChange(v: number): void; options: { i: number; label: string }[] }) {
  return (
    <div className="kv">
      <span className="k">{label}</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {options.map((o) => (
          <option key={o.i} value={o.i}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
