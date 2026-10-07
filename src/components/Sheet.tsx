import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useUI } from '../store'

/** Lo que la pila de hojas le cuenta a cada hoja: si se está cerrando y su posición. */
export const SheetCtx = createContext<{ closing: boolean; index: number }>({ closing: false, index: 0 })

const root = () => document.documentElement

/**
 * Arrastrar hacia abajo para cerrar, como las hojas de iOS:
 * - desde la manija/título siempre; desde el contenido solo si ya está arriba del todo
 * - sigue el dedo, con resistencia si tiras hacia arriba
 * - cierra si pasas un tercio de la altura o si sueltas con velocidad
 * - la primera hoja también mueve la pantalla de atrás (push-back) con el dedo
 */
function useDragToDismiss(
  sheet: React.RefObject<HTMLDivElement | null>,
  body: React.RefObject<HTMLDivElement | null>,
  index: number,
  close: () => void,
) {
  useEffect(() => {
    const el = sheet.current
    if (!el) return
    let startY = 0
    let startX = 0
    let lastY = 0
    let lastT = 0
    let velocity = 0
    let dragging = false
    let tracking = false
    let fromHandle = false

    const setPush = (p: number) => {
      if (index === 0) root().style.setProperty('--push', String(Math.max(0, Math.min(1, p))))
    }

    const begin = (y: number, x: number, target: EventTarget | null) => {
      const t = target as HTMLElement
      // Nunca robarle el gesto a un control o a un carrusel horizontal
      if (t.closest('input, textarea, select, .acct-scroll, .suggest, .keypad, .rings, .chart')) return
      tracking = true
      dragging = false
      fromHandle = !!t.closest('.sheet-top')
      startY = lastY = y
      startX = x
      lastT = performance.now()
      velocity = 0
    }

    const move = (y: number, x: number, e: Event) => {
      if (!tracking) return
      const dy = y - startY
      if (!dragging) {
        const atTop = (body.current?.scrollTop ?? 0) <= 0
        if (Math.abs(x - startX) > Math.abs(dy)) {
          tracking = false
          return
        }
        if (dy > 6 && (fromHandle || atTop)) {
          dragging = true
          root().classList.add('sheet-dragging')
          el.classList.add('dragging')
        } else {
          if (Math.abs(dy) > 6) tracking = false
          return
        }
      }
      if (e.cancelable) e.preventDefault()
      const now = performance.now()
      velocity = (y - lastY) / Math.max(1, now - lastT)
      lastY = y
      lastT = now
      const offset = dy > 0 ? dy : dy / 4 // resistencia hacia arriba
      el.style.transform = `translate(-50%, ${offset}px)`
      setPush(1 - offset / el.offsetHeight)
    }

    const end = () => {
      if (!tracking) return
      tracking = false
      if (!dragging) return
      dragging = false
      root().classList.remove('sheet-dragging')
      el.classList.remove('dragging')
      const dy = lastY - startY
      const h = el.offsetHeight
      if (dy > h / 3 || (velocity > 0.6 && dy > 24)) {
        // Sale a la velocidad del dedo (entre 140 y 280 ms)
        const ms = Math.round(Math.max(140, Math.min(280, (h - dy) / Math.max(velocity, 1.2))))
        el.style.animationDuration = `${ms}ms`
        setPush(0)
        close()
      } else {
        el.style.transform = ''
        setPush(1)
      }
    }

    const onTouchStart = (e: TouchEvent) => begin(e.touches[0].clientY, e.touches[0].clientX, e.target)
    const onTouchMove = (e: TouchEvent) => move(e.touches[0].clientY, e.touches[0].clientX, e)
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') begin(e.clientY, e.clientX, e.target)
    }
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.buttons === 1) move(e.clientY, e.clientX, e)
    }
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') end()
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', end)
    el.addEventListener('touchcancel', end)
    el.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', end)
      el.removeEventListener('touchcancel', end)
      el.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [sheet, body, index, close])
}

/**
 * Hoja inferior estilo iOS/Copilot: manija, título pequeño en mayúsculas,
 * botón de cerrar en círculo y acción principal abajo. Se pueden apilar (detalle → editar).
 */
export function Sheet({
  title,
  sub,
  right,
  footer,
  footerBar,
  full,
  children,
}: {
  title?: string
  sub?: ReactNode
  right?: ReactNode
  footer?: ReactNode
  /** El pie es una barra de color de borde a borde (SAVE de Copilot). */
  footerBar?: boolean
  full?: boolean
  children: ReactNode
}) {
  const close = useUI((s) => s.closeSheet)
  const { closing, index } = useContext(SheetCtx)
  const sheetRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  useDragToDismiss(sheetRef, bodyRef, index, close)

  return (
    <>
      <div className={`backdrop ${closing ? 'closing' : ''}`} onClick={closing ? undefined : close} />
      <div
        ref={sheetRef}
        className={`sheet ${full ? 'full' : ''} ${closing ? 'closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="sheet-top">
          {right && <div className="corner left">{right}</div>}
          {title && <span className="caps">{title}</span>}
          {sub && <div className="sub">{sub}</div>}
          <button className="corner right" onClick={close} aria-label="Cerrar">
            <X size={16} strokeWidth={2.6} />
          </button>
        </div>
        <div className="sheet-body" ref={bodyRef}>
          {children}
        </div>
        {footer && <div className={`sheet-foot ${footerBar ? 'edge' : ''}`}>{footer}</div>}
      </div>
    </>
  )
}

/**
 * Con hojas abiertas: congela la página de atrás (en iOS `overflow: hidden` no basta,
 * hay que fijar el body y recordar el scroll) y cierra la de arriba con Escape.
 */
export function useSheetEffects(open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return
    const y = window.scrollY
    const b = document.body
    b.classList.add('locked')
    b.style.position = 'fixed'
    b.style.top = `-${y}px`
    b.style.left = '0'
    b.style.right = '0'
    root().style.setProperty('--push', '1')
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      b.classList.remove('locked')
      b.style.position = ''
      b.style.top = ''
      b.style.left = ''
      b.style.right = ''
      window.scrollTo(0, y)
    }
  }, [open, close])
}
