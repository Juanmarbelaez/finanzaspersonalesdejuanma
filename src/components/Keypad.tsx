import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Delete } from 'lucide-react'
import { useStore } from '../store'
import { currencyDecimals } from '../lib/format'
import { haptic } from '../lib/haptic'

function separators(locale: string) {
  const parts = new Intl.NumberFormat(locale).formatToParts(1234.5)
  return {
    group: parts.find((p) => p.type === 'group')?.value ?? ',',
    decimal: parts.find((p) => p.type === 'decimal')?.value ?? '.',
  }
}

function toRaw(value: number | null, decimals: number): string {
  if (value === null || !Number.isFinite(value) || value <= 0) return ''
  if (!decimals) return String(Math.round(value))
  const fixed = value.toFixed(decimals).replace(/\.?0+$/, '')
  return fixed
}

export type PadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '000' | 'dec' | 'del' | 'clear'

/**
 * Monto escrito con el teclado propio. Guarda el texto crudo ("45000", "12.5")
 * y lo muestra con separadores de la moneda ("45.000", "12,5").
 */
export function useAmount(initial: number | null) {
  const locale = useStore((s) => s.settings.locale)
  const currency = useStore((s) => s.settings.currency)
  const decimals = currencyDecimals(currency)
  const sep = useMemo(() => separators(locale), [locale])
  const [raw, setRaw] = useState(() => toRaw(initial, decimals))

  const press = useCallback(
    (k: PadKey) => {
      setRaw((r) => {
        if (k === 'clear') return ''
        if (k === 'del') return r.slice(0, -1)
        if (k === 'dec') return decimals && !r.includes('.') ? (r || '0') + '.' : r
        const [int, frac] = r.split('.')
        if (frac !== undefined) {
          if (k === '000' || frac.length >= decimals) return r
          return r + k
        }
        if (int.length >= 12) return r
        if (k === '000') return int ? r + '000' : r
        if (k === '0' && !int) return r
        return r + k
      })
    },
    [decimals],
  )

  const value = raw ? Number(raw) : null
  const [int, frac] = raw.split('.')
  const display = (int ? new Intl.NumberFormat(locale).format(Number(int)) : '0') + (frac !== undefined ? sep.decimal + frac : '')

  return { raw, value, display, press, setRaw, decimals, decimalSep: sep.decimal, empty: !raw }
}

/** Número grande con cursor parpadeante. Al tocarlo se abre el teclado. */
export function AmountDisplay({
  display,
  empty,
  active,
  onActivate,
  shake,
  className = '',
  label = 'Monto',
}: {
  display: string
  empty: boolean
  active: boolean
  onActivate(): void
  /** Cambia el número para disparar la sacudida (error prescriptivo). */
  shake?: number
  className?: string
  label?: string
}) {
  return (
    <button
      type="button"
      className={`amount-big num ${empty ? 'empty' : ''} ${className}`}
      onClick={onActivate}
      aria-label={`${label}: ${empty ? 'vacío' : display}`}
    >
      <span key={shake} className={shake ? 'shake' : undefined} style={{ display: 'inline-flex', alignItems: 'flex-start' }}>
        <span className="sym">$</span>
        <span>{display}</span>
        {active && <span className="caret" aria-hidden />}
      </span>
    </button>
  )
}

/**
 * Teclado numérico propio (como el de Copilot), pensado para pesos:
 * la tecla "000" ahorra la mitad de los toques en montos colombianos.
 */
export function Keypad({ onKey, decimals, decimalSep }: { onKey(k: PadKey): void; decimals: number; decimalSep: string }) {
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tap = (k: PadKey) => {
    haptic()
    onKey(k)
  }
  const keys: PadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', decimals ? 'dec' : '000', '0', 'del']

  // En computador también se escribe con el teclado físico
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return
      if (/^[0-9]$/.test(e.key)) onKey(e.key as PadKey)
      else if (e.key === 'Backspace') onKey('del')
      else if ((e.key === ',' || e.key === '.') && decimals) onKey('dec')
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onKey, decimals])
  return (
    <div className="keypad" role="group" aria-label="Teclado numérico">
      {keys.map((k) =>
        k === 'del' ? (
          <button
            key={k}
            type="button"
            className="key fn"
            aria-label="Borrar (mantén para borrar todo)"
            onClick={() => tap('del')}
            onPointerDown={() => {
              hold.current = setTimeout(() => {
                haptic()
                onKey('clear')
              }, 500)
            }}
            onPointerUp={() => hold.current && clearTimeout(hold.current)}
            onPointerLeave={() => hold.current && clearTimeout(hold.current)}
          >
            <Delete size={22} />
          </button>
        ) : (
          <button key={k} type="button" className={`key ${k === '000' || k === 'dec' ? 'fn' : ''}`} onClick={() => tap(k)}>
            {k === 'dec' ? decimalSep : k}
          </button>
        ),
      )}
    </div>
  )
}
