const ZERO_DECIMAL = new Set(['COP', 'CLP', 'JPY', 'PYG', 'KRW', 'VND'])

const cache = new Map<string, Intl.NumberFormat>()

function nf(locale: string, currency: string, compact: boolean): Intl.NumberFormat {
  const key = `${locale}|${currency}|${compact}`
  let f = cache.get(key)
  if (!f) {
    const digits = ZERO_DECIMAL.has(currency) ? 0 : 2
    f = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      ...(compact
        ? { notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: 1 }
        : { minimumFractionDigits: digits, maximumFractionDigits: digits }),
    })
    cache.set(key, f)
  }
  return f
}

export interface MoneyOpts {
  /** Muestra + en positivos. */
  sign?: boolean
  compact?: boolean
}

export function formatMoney(value: number, locale: string, currency: string, opts: MoneyOpts = {}): string {
  const out = nf(locale, currency, !!opts.compact)
    .format(Math.abs(value))
    // "$ 1.234" -> "$1.234": más limpio en pantalla
    .replace(/(\p{Sc})\s+/u, '$1')
  if (value < 0) return `−${out}`
  if (opts.sign && value > 0) return `+${out}`
  return out
}

export interface MoneyParts {
  sign: '' | '−' | '+'
  symbol: string
  body: string
  symbolFirst: boolean
}

/** Partes separadas para pintar el símbolo pequeño ("$" chiquito como en Copilot). */
export function moneyParts(value: number, locale: string, currency: string, opts: MoneyOpts = {}): MoneyParts {
  const parts = nf(locale, currency, !!opts.compact).formatToParts(Math.abs(value))
  const symIndex = parts.findIndex((p) => p.type === 'currency')
  const firstNum = parts.findIndex((p) => p.type === 'integer')
  const body = parts
    .filter((p) => p.type !== 'currency' && !(p.type === 'literal' && /^\s+$/.test(p.value)))
    .map((p) => p.value)
    .join('')
    .trim()
  return {
    sign: value < 0 ? '−' : opts.sign && value > 0 ? '+' : '',
    symbol: symIndex >= 0 ? parts[symIndex].value : '',
    body,
    symbolFirst: symIndex < firstNum,
  }
}

export function currencyDecimals(currency: string): number {
  return ZERO_DECIMAL.has(currency) ? 0 : 2
}

export function formatPercent(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(value)
}
