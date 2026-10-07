import { useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { useFmt, useLocale } from '../hooks'
import { shortMonthLabel } from '../lib/dates'
import { statusColor, type Status } from './ui'

const W = 340

function barPath(x: number, y: number, w: number, h: number, r = 3): string {
  if (Math.abs(h) < 0.5) return ''
  if (h < 0) {
    // barra negativa: esquinas redondeadas abajo
    const hh = -h
    const rr = Math.min(r, w / 2, hh)
    return `M${x},${y}V${y + hh - rr}Q${x},${y + hh} ${x + rr},${y + hh}H${x + w - rr}Q${x + w},${y + hh} ${x + w},${y + hh - rr}V${y}Z`
  }
  const rr = Math.min(r, w / 2, h)
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`
}

function Tip({ x, children }: { x: number; children: ReactNode }) {
  const pct = Math.min(Math.max(x / W, 0.16), 0.84) * 100
  return (
    <div className="tooltip" style={{ left: `${pct}%` }}>
      {children}
    </div>
  )
}

function useHoverIndex(count: number) {
  const ref = useRef<SVGSVGElement>(null)
  const [i, setI] = useState<number | null>(null)
  const onMove = (e: PointerEvent) => {
    const rect = ref.current!.getBoundingClientRect()
    const rel = (e.clientX - rect.left) / rect.width
    setI(Math.max(0, Math.min(count - 1, Math.floor(rel * count))))
  }
  return { ref, i, onMove, clear: () => setI(null) }
}

/* ------------- Resumen: gasto acumulado vs ritmo del presupuesto ------------- */

export function PaceChart({
  cumulative,
  previous,
  budget,
  expected,
  upToDay,
  month,
}: {
  cumulative: number[]
  previous: number[]
  budget: number | null
  /** Gasto esperado acumulado por día (con pagos fijos en su fecha). */
  expected?: number[]
  upToDay: number
  month: string
}) {
  const fmt = useFmt()
  const locale = useLocale()
  const ref = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const H = 128
  const top = 26
  const bottom = 8
  const plotH = H - top - bottom
  const days = cumulative.length
  const shown = cumulative.slice(0, upToDay)
  const prev = Array.from({ length: days }, (_, i) => previous[Math.min(i, previous.length - 1)] ?? 0)
  const pace = (i: number) => (budget ? (expected?.[i] ?? (budget * (i + 1)) / days) : 0)
  const max = Math.max(1, ...shown, budget ?? Math.max(...prev)) * 1.05
  const x = (i: number) => 8 + (i / Math.max(1, days - 1)) * (W - 16)
  const y = (v: number) => top + plotH - (v / max) * plotH

  // Color por tramo según si vas por encima del ritmo esperado
  const status = (i: number): Status => {
    if (!budget) return 'ok'
    if (shown[i] > budget) return 'over'
    const d = shown[i] - pace(i)
    return d <= budget * 0.02 ? 'ok' : d <= budget * 0.1 ? 'warn' : 'over'
  }

  const last = shown.length - 1
  const diff = budget && last >= 0 ? pace(last) - shown[last] : 0
  const endStatus: Status = last >= 0 ? status(last) : 'ok'

  const onMove = (e: PointerEvent) => {
    const rect = ref.current!.getBoundingClientRect()
    const rel = ((e.clientX - rect.left) / rect.width) * W
    setHover(Math.max(0, Math.min(days - 1, Math.round(((rel - 8) / (W - 16)) * (days - 1)))))
  }

  const lx = last >= 0 ? x(last) : 0
  const ly = last >= 0 ? y(shown[last]) : 0
  const label = budget ? `${fmt(Math.abs(diff), { compact: Math.abs(diff) >= 1e5 })} ${diff >= 0 ? 'bajo el ritmo' : 'sobre el ritmo'}` : ''
  const labelW = label.length * 6 + 14
  const labelX = Math.min(Math.max(lx - labelW / 2, 0), W - labelW)

  return (
    <div style={{ position: 'relative', marginTop: 8 }}>
      {hover !== null && (
        <Tip x={x(hover)}>
          <div style={{ opacity: 0.7 }}>
            {hover + 1} {shortMonthLabel(month, locale).toLowerCase()}
          </div>
          {hover <= last && <div>Gastado {fmt(cumulative[hover])}</div>}
          {budget ? <div>Ritmo ideal {fmt(pace(hover))}</div> : <div>Mes pasado {fmt(prev[hover])}</div>}
        </Tip>
      )}
      <svg
        ref={ref}
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={budget ? `Gasto del mes frente al ritmo del presupuesto: ${label}` : 'Gasto acumulado del mes'}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
        style={{ touchAction: 'pan-y' }}
      >
        {budget ? (
          <polyline
            points={Array.from({ length: days }, (_, i) => `${x(i)},${y(pace(i))}`).join(' ')}
            fill="none"
            stroke="var(--text-3)"
            strokeWidth={1.5}
            strokeDasharray="3 5"
          />
        ) : (
          <polyline
            points={prev.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
            fill="none"
            stroke="var(--text-3)"
            strokeWidth={1.5}
            strokeDasharray="3 5"
          />
        )}
        {shown.slice(1).map((v, k) => {
          const i = k + 1
          return (
            <line
              key={i}
              x1={x(i - 1)}
              y1={y(shown[i - 1])}
              x2={x(i)}
              y2={y(v)}
              stroke={budget ? statusColor(status(i)) : 'var(--accent)'}
              strokeWidth={3}
              strokeLinecap="round"
            />
          )
        })}
        {last >= 0 && (
          <>
            {budget ? (
              <g>
                <rect x={labelX} y={ly - 30} width={labelW} height={19} rx={4} fill={statusColor(endStatus)} />
                <text x={labelX + labelW / 2} y={ly - 17} textAnchor="middle" className="tag-badge" style={{ fill: '#fff' }}>
                  {label}
                </text>
              </g>
            ) : null}
            <circle
              cx={lx}
              cy={ly}
              r={5}
              fill="var(--surface)"
              stroke={budget ? statusColor(endStatus) : 'var(--accent)'}
              strokeWidth={3}
            />
          </>
        )}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={top - 6} y2={top + plotH} stroke="var(--text-3)" strokeWidth={1} />}
      </svg>
    </div>
  )
}

/* ------------- Barras por mes contra el presupuesto (categoría) ------------- */

export function MonthBars({
  data,
  budget,
  selected,
  onSelect,
}: {
  data: { month: string; amount: number }[]
  budget: number | null
  selected: string
  onSelect?(month: string): void
}) {
  const fmt = useFmt()
  const locale = useLocale()
  const { ref, i: hover, onMove, clear } = useHoverIndex(data.length)
  const H = 132
  const top = 10
  const bottom = 18
  const plotH = H - top - bottom
  const max = Math.max(1, ...data.map((d) => d.amount), budget ?? 0) * 1.08
  const group = (W - 46) / data.length
  const bw = Math.max(4, Math.min(16, group * 0.55))
  const base = top + plotH
  const by = budget ? base - (budget / max) * plotH : 0

  const color = (v: number) => {
    if (!budget) return 'var(--text)'
    if (v > budget) return 'var(--over)'
    if (v > budget * 0.9) return 'var(--warn)'
    return 'var(--ok)'
  }

  return (
    <div style={{ position: 'relative' }}>
      {hover !== null && (
        <Tip x={group * hover + group / 2}>
          {shortMonthLabel(data[hover].month, locale)} · <b>{fmt(data[hover].amount)}</b>
        </Tip>
      )}
      <svg
        ref={ref}
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Gasto por mes"
        onPointerMove={onMove}
        onPointerLeave={clear}
        style={{ touchAction: 'pan-y' }}
      >
        <line x1={0} x2={W - 46} y1={base} y2={base} stroke="var(--line)" />
        {data.map((d, i) => {
          const cx = group * i + group / 2
          const h = (d.amount / max) * plotH
          const active = d.month === selected
          const empty = d.amount === 0
          return (
            <g key={d.month} onClick={() => onSelect?.(d.month)} style={{ cursor: onSelect ? 'pointer' : undefined }}>
              <rect x={group * i} y={0} width={group} height={H} fill="transparent" />
              {empty ? (
                <line x1={cx - bw / 2} x2={cx + bw / 2} y1={base - 1} y2={base - 1} stroke="var(--surface-3)" strokeWidth={2} />
              ) : (
                <path d={barPath(cx - bw / 2, base - h, bw, h)} fill={color(d.amount)} opacity={active || hover === i ? 1 : 0.75} />
              )}
              <text x={cx} y={H - 3} textAnchor="middle" style={active ? { fill: 'var(--text)', fontWeight: 700 } : undefined}>
                {shortMonthLabel(d.month, locale).charAt(0)}
              </text>
            </g>
          )
        })}
        {budget ? (
          <g>
            <line x1={0} x2={W - 44} y1={by} y2={by} stroke="var(--text)" strokeWidth={1.5} />
            <rect x={W - 46} y={by - 9} width={46} height={18} rx={4} fill="var(--text)" />
            <text x={W - 23} y={by + 4} textAnchor="middle" className="tag-badge" style={{ fill: 'var(--bg)' }}>
              {fmt(budget, { compact: true })}
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  )
}

/* ------------- Barras de flujo (neto positivo/negativo o gasto) ------------- */

export function FlowBars({
  data,
  mode,
  labelEvery = 1,
}: {
  data: { label: string; tip: string; value: number }[]
  /** net: verde arriba / rojo abajo. spend: morado. income: verde. */
  mode: 'net' | 'spend' | 'income'
  labelEvery?: number
}) {
  const fmt = useFmt()
  const { ref, i: hover, onMove, clear } = useHoverIndex(data.length)
  const H = 150
  const top = 8
  const bottom = 18
  const left = 40
  const plotH = H - top - bottom
  const maxV = Math.max(0, ...data.map((d) => d.value))
  const minV = Math.min(0, ...data.map((d) => d.value))
  const span = Math.max(1, maxV - minV) * 1.08
  const y = (v: number) => top + ((maxV * 1.04 - v) / span) * plotH
  const group = (W - left) / data.length
  const bw = Math.max(2, Math.min(14, group * 0.6))
  const zero = y(0)
  const fill = (v: number) =>
    mode === 'spend' ? 'var(--text)' : mode === 'income' ? 'var(--accent)' : v >= 0 ? 'var(--ok)' : 'var(--over)'

  return (
    <div style={{ position: 'relative' }}>
      {hover !== null && (
        <Tip x={left + group * hover + group / 2}>
          {data[hover].tip} · <b>{fmt(data[hover].value, { sign: mode === 'net' })}</b>
        </Tip>
      )}
      <svg
        ref={ref}
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Barras por periodo"
        onPointerMove={(e) => {
          const rect = ref.current!.getBoundingClientRect()
          const rel = ((e.clientX - rect.left) / rect.width) * W
          if (rel < left) return clear()
          onMove({ ...e, clientX: rect.left + ((rel - left) / (W - left)) * rect.width } as PointerEvent)
        }}
        onPointerLeave={clear}
        style={{ touchAction: 'pan-y' }}
      >
        {[maxV, 0, minV]
          .filter((v, i, a) => a.indexOf(v) === i && (v !== 0 || true))
          .map((v) => (
            <g key={v}>
              <line x1={left} x2={W} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray={v === 0 ? undefined : '2 4'} />
              <text x={0} y={y(v) + 3}>
                {fmt(v, { compact: true })}
              </text>
            </g>
          ))}
        {data.map((d, i) => {
          const cx = left + group * i + group / 2
          const h = zero - y(d.value)
          return (
            <g key={i} opacity={hover === null || hover === i ? 1 : 0.55}>
              <path
                d={barPath(cx - bw / 2, d.value >= 0 ? y(d.value) : zero, bw, d.value >= 0 ? h : -(y(d.value) - zero), 2)}
                fill={fill(d.value)}
              />
              {i % labelEvery === 0 && (
                <text x={cx} y={H - 3} textAnchor="middle">
                  {d.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/* ------------- Línea simple (patrimonio, historial de recurrente) ------------- */

export function TrendLine({
  values,
  labels,
  height = 110,
  dashedLast = false,
}: {
  values: number[]
  labels?: string[]
  height?: number
  /** El último tramo punteado (el próximo pago esperado). */
  dashedLast?: boolean
}) {
  const fmt = useFmt()
  const { ref, i: hover, onMove, clear } = useHoverIndex(values.length)
  const H = height
  const top = 12
  const bottom = labels ? 20 : 8
  const plotH = H - top - bottom
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || Math.abs(max) || 1
  const x = (i: number) => 8 + (i / Math.max(1, values.length - 1)) * (W - 16)
  const y = (v: number) => top + plotH - ((v - min) / span) * plotH
  const up = values[values.length - 1] >= values[0]
  const color = up ? 'var(--ok)' : 'var(--over)'
  const solid = dashedLast ? values.slice(0, -1) : values
  const last = values.length - 1

  if (values.length === 0) return null

  return (
    <div style={{ position: 'relative' }}>
      {hover !== null && (
        <Tip x={x(hover)}>
          {labels?.[hover] ? `${labels[hover]} · ` : ''}
          <b>{fmt(values[hover])}</b>
        </Tip>
      )}
      <svg
        ref={ref}
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Tendencia"
        onPointerMove={onMove}
        onPointerLeave={clear}
        style={{ touchAction: 'pan-y' }}
      >
        <polyline
          points={solid.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
          fill="none"
          stroke={dashedLast ? 'var(--accent)' : color}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {dashedLast && values.length > 1 && (
          <line
            x1={x(last - 1)}
            y1={y(values[last - 1])}
            x2={x(last)}
            y2={y(values[last])}
            stroke="var(--text-3)"
            strokeWidth={2}
            strokeDasharray="3 4"
          />
        )}
        {dashedLast &&
          values.map((v, i) => (
            <circle
              key={i}
              cx={x(i)}
              cy={y(v)}
              r={4}
              fill="var(--surface)"
              stroke={i === last ? 'var(--text-3)' : 'var(--accent)'}
              strokeWidth={2}
            />
          ))}
        {!dashedLast && <circle cx={x(last)} cy={y(values[last])} r={4.5} fill="var(--surface)" stroke={color} strokeWidth={2.5} />}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={top} y2={top + plotH} stroke="var(--text-3)" strokeWidth={1} />}
        {labels &&
          labels.map((l, i) =>
            i === 0 || i === last || labels.length <= 7 ? (
              <text key={i} x={x(i)} y={H - 4} textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'}>
                {l}
              </text>
            ) : null,
          )}
      </svg>
    </div>
  )
}
