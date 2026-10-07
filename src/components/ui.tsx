import type { ReactNode } from 'react'
import { Check, ChevronRight } from 'lucide-react'
import { haptic } from '../lib/haptic'
import { useStore } from '../store'
import { moneyParts, type MoneyOpts } from '../lib/format'
import type { Account, Category } from '../lib/types'

/** Monto con el "$" pequeño, como en Copilot. */
export function Money({ value, className = '', ...opts }: { value: number; className?: string } & MoneyOpts) {
  const locale = useStore((s) => s.settings.locale)
  const currency = useStore((s) => s.settings.currency)
  const p = moneyParts(value, locale, currency, opts)
  return (
    <span className={`money num ${className}`}>
      {p.sign}
      {p.symbolFirst && <span className="sym">{p.symbol}</span>}
      {p.body}
      {!p.symbolFirst && <span className="sym"> {p.symbol}</span>}
    </span>
  )
}

export function CatPill({
  category,
  big,
  onClick,
  selected,
}: {
  category: Pick<Category, 'emoji' | 'name'> | undefined
  big?: boolean
  onClick?(): void
  selected?: boolean
}) {
  // Etiquetas neutras como los tags del sistema: el emoji pone el color.
  const c = category ?? { emoji: '❔', name: 'Sin categoría' }
  const cls = `cat-pill ${big ? 'big' : ''} ${selected ? 'selected' : ''}`
  const inner = (
    <>
      <span className="e">{c.emoji}</span>
      <span className="t">{c.name}</span>
    </>
  )
  return onClick ? (
    <button type="button" className={cls} onClick={onClick} aria-pressed={selected}>
      {inner}
    </button>
  ) : (
    <span className={cls}>{inner}</span>
  )
}

export type Status = 'ok' | 'warn' | 'over'

export const statusColor = (s: Status) => (s === 'over' ? 'var(--over)' : s === 'warn' ? 'var(--warn)' : 'var(--ok)')

/** Estado contra lo esperado a la fecha (ver lib/pace.ts). Sin `expected`, se mira al cierre del mes. */
export function statusOf(spent: number, budget: number, expected = budget): Status {
  if (spent > budget) return 'over'
  if (spent > expected + budget * 0.1) return 'warn'
  return 'ok'
}

/** Anillo de presupuesto con emoji al centro. */
export function Ring({
  value,
  max,
  status,
  emoji,
  text,
  size = 62,
  stroke = 4.5,
}: {
  value: number
  max: number
  status: Status
  emoji?: string
  /** Texto al centro en vez de emoji (ej. "62%"). */
  text?: string
  size?: number
  stroke?: number
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = max > 0 ? Math.min(1, value / max) : 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden style={{ display: 'block', margin: '0 auto' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="var(--surface)" stroke="var(--surface-3)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={statusColor(status)}
        strokeWidth={stroke}
        strokeDasharray={`${c * pct} ${c}`}
        strokeLinecap="round"
        className="ring-arc"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fontSize={text ? size * 0.2 : size * 0.36}
        fontWeight={800}
        fill="var(--text)"
        style={{ letterSpacing: text ? '-0.05em' : 0, fontFamily: 'var(--font)' }}
      >
        {text ?? emoji}
      </text>
    </svg>
  )
}

/** Dona de varios segmentos (gasto por categoría, pagado vs pendiente). */
export function Donut({
  segments,
  size = 92,
  stroke = 11,
}: {
  segments: { value: number; color: string }[]
  size?: number
  stroke?: number
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const total = segments.reduce((s, x) => s + x.value, 0)
  const gap = segments.filter((s) => s.value > 0).length > 1 ? 2 : 0
  let offset = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
      {total > 0 &&
        segments.map((s, i) => {
          const len = (s.value / total) * c
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${Math.max(0, len - gap)} ${c}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          )
          offset += len
          return el
        })}
    </svg>
  )
}

export function AccountCard({
  account,
  big,
  selected,
  onClick,
}: {
  account: Pick<Account, 'name' | 'color' | 'type'>
  big?: boolean
  selected?: boolean
  onClick?(): void
}) {
  const type = ACCOUNT_TYPE_LABEL[account.type]
  const cls = `acct-card ${big ? 'big' : ''} ${selected ? 'selected' : ''}`
  const style = { '--c': account.color, '--fg': isLight(account.color) ? '#000' : '#fff' } as React.CSSProperties
  const inner = (
    <>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: selected && onClick ? 18 : 0 }}>
        {account.name}
      </span>
      <span className="t">{type}</span>
      {selected && onClick && (
        <span className="tick" aria-hidden>
          <Check size={11} strokeWidth={3.5} />
        </span>
      )}
    </>
  )
  return onClick ? (
    <button
      type="button"
      className={cls}
      style={style}
      onClick={() => {
        if (!selected) haptic()
        onClick()
      }}
      aria-pressed={selected}
    >
      {inner}
    </button>
  ) : (
    <div className={cls} style={style}>
      {inner}
    </div>
  )
}

function isLight(hex: string): boolean {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  return 0.299 * r + 0.587 * g + 0.114 * b > 165
}

export const ACCOUNT_TYPE_LABEL: Record<Account['type'], string> = {
  bank: 'Cuenta bancaria',
  savings: 'Ahorros',
  cash: 'Efectivo',
  credit: 'Tarjeta de crédito',
  investment: 'Inversión',
}

export function SectionHead({ title, more, onMore }: { title: string; more?: string; onMore?(): void }) {
  return (
    <div className="section-head">
      <h2 className="eyebrow">{title}</h2>
      {more && (
        <button className="more" onClick={onMore}>
          {more} ›
        </button>
      )}
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange(v: T): void
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          className={o.value === value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Periods<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange(v: T): void
}) {
  return (
    <div className="periods">
      {options.map((o) => (
        <button key={o.value} type="button" className={o.value === value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange(v: boolean): void; label: string }) {
  return (
    <button
      type="button"
      className={`toggle ${on ? 'on' : ''}`}
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => {
        haptic()
        onChange(!on)
      }}
    />
  )
}

export function Delta({ current, previous, invert = false }: { current: number; previous: number; invert?: boolean }) {
  if (!previous) return null
  const pct = (current - previous) / Math.abs(previous)
  const up = pct > 0
  // En gastos, subir es malo; en ingresos/neto, subir es bueno
  const good = invert ? !up : up
  const flat = Math.abs(pct) < 0.005
  return (
    <span className={`delta ${flat ? 'flat' : good ? 'good' : 'bad'}`}>
      {flat ? '=' : up ? '↗' : '↘'} {Math.abs(pct * 100).toFixed(Math.abs(pct) < 0.1 ? 1 : 0)}%
    </span>
  )
}

export function Empty({ art, title, text, children }: { art: ReactNode; title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="art">{art}</div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {children}
    </div>
  )
}

export function ListItem({ label, value, onClick, danger }: { label: ReactNode; value?: ReactNode; onClick?(): void; danger?: boolean }) {
  return (
    <button type="button" className={`item ${danger ? 'danger' : ''}`} onClick={onClick}>
      <span>{label}</span>
      <span className="r">
        {value}
        {onClick && !danger && <ChevronRight size={16} />}
      </span>
    </button>
  )
}
