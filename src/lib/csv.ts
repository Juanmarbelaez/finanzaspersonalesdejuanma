/** Detecta el separador mirando la primera línea con contenido. */
export function detectDelimiter(text: string): string {
  const line = text.split(/\r?\n/).find((l) => l.trim()) ?? ''
  const counts = [';', ',', '\t', '|'].map((d) => [d, line.split(d).length - 1] as const)
  counts.sort((a, b) => b[1] - a[1])
  return counts[0][1] > 0 ? counts[0][0] : ','
}

/** Parser de CSV con soporte de comillas ("a, b" y "" escapadas). */
export function parseCSV(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const src = text.replace(/^﻿/, '')

  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === delimiter) {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.map((r) => r.map((f) => f.trim())).filter((r) => r.some((f) => f !== ''))
}

/**
 * Lee montos en formatos de banco colombiano y gringo:
 * "1.234.567,89", "1,234,567.89", "$ -45.000", "(45.000)", "45000".
 */
export function parseAmount(raw: string): number | null {
  let s = raw.trim()
  if (!s) return null
  let negative = false
  if (/^\(.*\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1)
  }
  if (s.includes('-') || s.includes('−')) negative = true
  s = s.replace(/[^\d.,]/g, '')
  if (!s) return null

  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  let decimalSep: '.' | ',' | null = null

  if (lastDot >= 0 && lastComma >= 0) {
    decimalSep = lastDot > lastComma ? '.' : ','
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? '.' : ','
    const occurrences = s.split(sep).length - 1
    const after = s.length - s.lastIndexOf(sep) - 1
    // Un solo separador seguido de exactamente 3 dígitos = miles ("45.000")
    decimalSep = occurrences === 1 && after !== 3 ? sep : null
  }

  let normalized = s
  if (decimalSep) {
    const thousands = decimalSep === '.' ? ',' : '.'
    normalized = s.split(thousands).join('').replace(decimalSep, '.')
  } else {
    normalized = s.replace(/[.,]/g, '')
  }
  const n = Number(normalized)
  if (!Number.isFinite(n)) return null
  return negative ? -n : n
}

export type DateFormat = 'ymd' | 'dmy' | 'mdy'

const DATE_RE = /^(\d{1,4})[/.\-](\d{1,2})[/.\-](\d{1,4})/

/** Adivina el formato de fecha mirando varias filas. Por defecto día/mes/año (Colombia). */
export function detectDateFormat(samples: string[]): DateFormat {
  let firstOver12 = false
  let secondOver12 = false
  for (const s of samples) {
    const m = DATE_RE.exec(s.trim())
    if (!m) continue
    if (m[1].length === 4) return 'ymd'
    if (Number(m[1]) > 12) firstOver12 = true
    if (Number(m[2]) > 12) secondOver12 = true
  }
  if (secondOver12 && !firstOver12) return 'mdy'
  return 'dmy'
}

export function parseDate(raw: string, format: DateFormat): string | null {
  const m = DATE_RE.exec(raw.trim())
  if (!m) return null
  let y: number, mo: number, d: number
  if (format === 'ymd') [y, mo, d] = [m[1], m[2], m[3]].map(Number)
  else if (format === 'dmy') [d, mo, y] = [m[1], m[2], m[3]].map(Number)
  else [mo, d, y] = [m[1], m[2], m[3]].map(Number)
  if (y < 100) y += 2000
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const date = new Date(y, mo - 1, d)
  if (date.getMonth() !== mo - 1) return null
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function toCSV(rows: (string | number)[][]): string {
  return rows
    .map((r) =>
      r
        .map((v) => {
          const s = String(v)
          return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
        })
        .join(','),
    )
    .join('\n')
}
