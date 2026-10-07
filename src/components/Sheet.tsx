import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useUI } from '../store'

/**
 * Hoja inferior estilo Copilot: manija arriba, título pequeño en mayúsculas
 * y acción principal abajo. Se pueden apilar (detalle -> editar).
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

  return (
    <>
      <div className="backdrop" onClick={close} />
      <div className={`sheet ${full ? 'full' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-top">
          {right && <div className="corner left">{right}</div>}
          {title && <span className="caps">{title}</span>}
          {sub && <div className="sub">{sub}</div>}
          <button className="corner right" onClick={close} aria-label="Cerrar">
            <X size={16} strokeWidth={2.6} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className={`sheet-foot ${footerBar ? 'bar' : ''}`}>{footer}</div>}
      </div>
    </>
  )
}

/** Mantiene el body quieto mientras haya hojas abiertas y cierra la de arriba con Escape. */
export function useSheetEffects(open: boolean, close: () => void) {
  useEffect(() => {
    document.body.classList.toggle('locked', open)
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.classList.remove('locked')
      window.removeEventListener('keydown', onKey)
    }
  }, [open, close])
}
