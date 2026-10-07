import { useEffect, useRef } from 'react'

/*
 * Moneymaxxer, la mascota de Plata (diseño de Juanma). Una pose por estado real de la app.
 * Cada vez que aparece llega desenfocado, sube un poco y se enfoca (ver .mascot en styles.css).
 */

export type MascotPose = 'idle' | 'welcome' | 'thinking' | 'savings' | 'success' | 'celebrate' | 'warning' | 'empty' | 'pointing' | 'review'

const ALT: Record<MascotPose, string> = {
  idle: 'Moneymaxxer con las manos en la cintura.',
  welcome: 'Moneymaxxer saluda con la mano.',
  thinking: 'Moneymaxxer se toca la barba mientras piensa.',
  savings: 'Moneymaxxer sostiene un billete.',
  success: 'Moneymaxxer levanta el pulgar.',
  celebrate: 'Moneymaxxer celebra con los brazos arriba.',
  warning: 'Moneymaxxer levanta la mano para que revises tus gastos.',
  empty: 'Moneymaxxer abre los brazos: todavía no hay nada.',
  pointing: 'Moneymaxxer señala hacia un lado.',
  review: 'Moneymaxxer sostiene un tablero con un check.',
}

export function Mascot({
  pose,
  size = 200,
  decorative = true,
  className = '',
}: {
  pose: MascotPose
  size?: number
  /** Si el texto de al lado ya dice lo mismo, la imagen es decorativa. */
  decorative?: boolean
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)

  // Arranca solo cuando la imagen ya está lista y a la vista: nunca "aparece de una"
  useEffect(() => {
    const el = ref.current
    const img = el?.querySelector('img')
    if (!el || !img) return
    el.classList.remove('play')
    let alive = true
    const ready = img.decode ? img.decode().catch(() => undefined) : Promise.resolve()
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        io.disconnect()
        ready.then(() => alive && requestAnimationFrame(() => el.classList.add('play')))
      },
      { threshold: 0.3 },
    )
    io.observe(el)
    return () => {
      alive = false
      io.disconnect()
    }
  }, [pose])

  const src = `./moneymaxxer/${pose}.webp`
  return (
    <span ref={ref} className={`mascot ${className}`} style={{ width: size, height: size }}>
      <img
        src={src}
        width={size}
        height={size}
        alt={decorative ? '' : ALT[pose]}
        aria-hidden={decorative || undefined}
        draggable={false}
        loading="eager"
      />
    </span>
  )
}
