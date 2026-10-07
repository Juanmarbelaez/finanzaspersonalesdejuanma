/*
 * Moneymaxxer, la mascota de Plata (diseño de Juanma). Una pose por estado real de la app.
 * Imágenes WebP de 720 px (los originales de 1254 px quedan fuera para que cargue rápido).
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
  /** Si el texto de al lado ya dice lo mismo, la imagen es decorativa (alt vacío). */
  decorative?: boolean
  className?: string
}) {
  return (
    <img
      className={`mascot ${className}`}
      src={`./moneymaxxer/${pose}.webp`}
      width={size}
      height={size}
      alt={decorative ? '' : ALT[pose]}
      aria-hidden={decorative || undefined}
      decoding="async"
      draggable={false}
    />
  )
}
