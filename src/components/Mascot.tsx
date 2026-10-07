import { useEffect, useRef } from 'react'

/*
 * Moneymaxxer, la mascota de Plata (diseño de Juanma). Una pose por estado real de la app.
 * Cada vez que aparece se construye de abajo hacia arriba en píxeles, como un personaje
 * de videojuego que se materializa: bloques grandes, luego más finos y al final nítido.
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

const images = new Map<string, Promise<HTMLImageElement>>()
function load(src: string) {
  let p = images.get(src)
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image()
      img.decoding = 'async'
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })
    images.set(src, p)
  }
  return p
}

const DURATION = 1400
const FPS = 24 // cuadros "de consola": el salto entre cuadros se nota a propósito
const BLOCKS = [0.09, 0.05, 0.025] // tamaño de bloque (fracción del lado), de grueso a fino
const BAND = 0.07 // alto de cada franja de resolución detrás del frente

/** Versión pixelada: se reduce la imagen y se vuelve a ampliar sin suavizado. */
function pixelate(img: HTMLImageElement, side: number, block: number) {
  const n = Math.max(4, Math.round(1 / block))
  const small = document.createElement('canvas')
  small.width = small.height = n
  small.getContext('2d')!.drawImage(img, 0, 0, n, n)
  const big = document.createElement('canvas')
  big.width = big.height = side
  const g = big.getContext('2d')!
  g.imageSmoothingEnabled = false
  g.drawImage(small, 0, 0, side, side)
  return big
}

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

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
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = Math.min(3, window.devicePixelRatio || 1)
    const side = Math.round(size * dpr)
    canvas.width = canvas.height = side
    const ctx = canvas.getContext('2d')!
    let raf = 0
    let stop = false
    let observer: IntersectionObserver | undefined

    load(`./moneymaxxer/${pose}.webp`).then((img) => {
      if (stop) return
      const full = () => {
        ctx.clearRect(0, 0, side, side)
        ctx.imageSmoothingEnabled = true
        ctx.drawImage(img, 0, 0, side, side)
      }
      if (reduced()) return full()

      const levels = BLOCKS.map((b) => pixelate(img, side, b))
      const cell = Math.round(side * BLOCKS[0])
      const steps = Math.round((DURATION / 1000) * FPS)
      const band = side * BAND
      const travel = side + band * levels.length
      let start = 0
      let lastStep = -1

      const frame = (now: number) => {
        const step = Math.min(steps, Math.floor(((now - start) / DURATION) * steps))
        if (step !== lastStep) {
          lastStep = step
          const p = step / steps
          const front = Math.round(side - (1 - Math.pow(1 - p, 2)) * travel)
          ctx.clearRect(0, 0, side, side)

          // Debajo de las franjas ya se ve nítido
          const sharpTop = Math.max(0, front + band * levels.length)
          if (sharpTop < side) {
            ctx.imageSmoothingEnabled = true
            ctx.drawImage(
              img,
              0,
              (sharpTop / side) * img.height,
              img.width,
              ((side - sharpTop) / side) * img.height,
              0,
              sharpTop,
              side,
              side - sharpTop,
            )
          }
          // Justo detrás del frente, bloques grandes; más abajo, cada vez más finos
          ctx.imageSmoothingEnabled = false
          levels.forEach((lvl, i) => {
            const y = Math.max(0, front + band * i)
            const h = Math.min(side, front + band * (i + 1)) - y
            if (h > 0) ctx.drawImage(lvl, 0, y, side, h, 0, y, side, h)
          })
          // Chispas: bloques sueltos que parpadean por encima del frente
          if (step < steps) {
            for (let k = 0; k < 8; k++) {
              const x = Math.floor(Math.random() * (side / cell)) * cell
              const y = front - cell * (1 + Math.floor(Math.random() * 3))
              if (y < 0) continue
              ctx.globalAlpha = 0.3 + Math.random() * 0.6
              ctx.drawImage(levels[0], x, y, cell, cell, x, y, cell, cell)
            }
            ctx.globalAlpha = 1
          }
        }
        if (step < steps) raf = requestAnimationFrame(frame)
        else full()
      }

      // Se construye cuando entra en pantalla: si está más abajo, espera a que lo veas
      observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return
          observer?.disconnect()
          start = performance.now()
          raf = requestAnimationFrame(frame)
        },
        { threshold: 0.3 },
      )
      observer.observe(canvas)
    })

    return () => {
      stop = true
      cancelAnimationFrame(raf)
      observer?.disconnect()
    }
  }, [pose, size])

  return (
    <span className={`mascot ${className}`} style={{ width: size, height: size }}>
      <canvas
        ref={ref}
        style={{ width: size, height: size }}
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : ALT[pose]}
        aria-hidden={decorative || undefined}
      />
    </span>
  )
}
