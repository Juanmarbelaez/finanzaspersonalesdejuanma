/**
 * Ilustraciones propias en el estilo del design system: trazo grueso verde,
 * formas redondeadas, relleno sólido con contorno (como el ícono de proteína).
 */

const S = { fill: 'none', stroke: 'var(--accent)', strokeWidth: 5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export function ArtReceipt({ size = 88 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 88 88" aria-hidden>
      <path d="M22 12h44v64l-7-5-7 5-8-5-8 5-7-5-7 5z" {...S} fill="var(--accent-soft)" />
      <path d="M32 30h24M32 42h24M32 54h14" {...S} />
    </svg>
  )
}

export function ArtCheck({ size = 88 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 88 88" aria-hidden>
      <circle cx="44" cy="44" r="30" {...S} fill="var(--accent-soft)" />
      <path d="M31 45l9 9 17-19" {...S} strokeWidth={6} />
    </svg>
  )
}

export function ArtCalendar({ size = 88 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 88 88" aria-hidden>
      <rect x="14" y="20" width="60" height="54" rx="8" {...S} fill="var(--accent-soft)" />
      <path d="M14 36h60M30 12v14M58 12v14" {...S} />
      <path d="M34 54l7 7 14-14" {...S} />
    </svg>
  )
}

export function ArtCoins({ size = 88 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 88 88" aria-hidden>
      <ellipse cx="38" cy="58" rx="22" ry="9" {...S} fill="var(--accent-soft)" />
      <path d="M16 58v-10M60 58v-10" {...S} />
      <ellipse cx="38" cy="46" rx="22" ry="9" {...S} fill="var(--accent-soft)" />
      <ellipse cx="54" cy="30" rx="18" ry="8" {...S} fill="var(--accent-soft)" />
      <path d="M36 30v8M72 30v10" {...S} />
    </svg>
  )
}

export function ArtCard({ size = 88 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 88 88" aria-hidden>
      <rect x="10" y="22" width="68" height="46" rx="8" {...S} fill="var(--accent-soft)" />
      <path d="M10 36h68M22 56h16" {...S} />
    </svg>
  )
}
