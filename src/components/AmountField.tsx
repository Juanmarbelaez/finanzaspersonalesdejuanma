import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { currencyDecimals } from '../lib/format'

function separators(locale: string) {
  const parts = new Intl.NumberFormat(locale).formatToParts(1234.5)
  return {
    group: parts.find((p) => p.type === 'group')?.value ?? ',',
    decimal: parts.find((p) => p.type === 'decimal')?.value ?? '.',
  }
}

function toText(value: number | null, locale: string, decimals: number): string {
  if (value === null || !Number.isFinite(value)) return ''
  return new Intl.NumberFormat(locale, { maximumFractionDigits: decimals }).format(value)
}

/**
 * Campo de monto que va poniendo los puntos de miles mientras escribes ("45.000").
 * `variant="big"` es el número grande centrado de la hoja de movimiento.
 */
export function AmountField({
  value,
  onChange,
  autoFocus,
  variant = 'inline',
  placeholder = '0',
  ariaLabel = 'Monto',
  className = '',
}: {
  value: number | null
  onChange(v: number | null): void
  autoFocus?: boolean
  variant?: 'big' | 'inline'
  placeholder?: string
  ariaLabel?: string
  className?: string
}) {
  const locale = useStore((s) => s.settings.locale)
  const currency = useStore((s) => s.settings.currency)
  const decimals = currencyDecimals(currency)
  const sep = useMemo(() => separators(locale), [locale])
  const [text, setText] = useState(() => toText(value, locale, decimals))

  const handle = (raw: string) => {
    let s = raw.split(sep.group).join('')
    if (decimals === 0) s = s.replace(/\D/g, '')
    else s = s.replace(/[.,]/g, sep.decimal).replace(new RegExp(`[^0-9\\${sep.decimal}]`, 'g'), '')
    const [intRaw, ...rest] = s.split(sep.decimal)
    const frac = rest.length ? rest.join('').slice(0, decimals) : undefined
    const int = intRaw.replace(/^0+(?=\d)/, '').slice(0, 13)
    const intFmt = int ? new Intl.NumberFormat(locale).format(Number(int)) : frac !== undefined ? '0' : ''
    const display = frac !== undefined ? `${intFmt}${sep.decimal}${frac}` : intFmt
    setText(display)
    const n = Number(`${int || '0'}.${frac ?? ''}`)
    onChange(display ? n : null)
  }

  const input = (
    <input
      value={text}
      onChange={(e) => handle(e.target.value)}
      inputMode={decimals ? 'decimal' : 'numeric'}
      placeholder={placeholder}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
      className="num"
      size={variant === 'big' ? 1 : undefined}
    />
  )

  if (variant === 'inline') return input
  return (
    <div className={`amount-big num ${className}`}>
      <span className="sym">$</span>
      <span className="autosize">
        <span aria-hidden>{text || placeholder}</span>
        {input}
      </span>
    </div>
  )
}
