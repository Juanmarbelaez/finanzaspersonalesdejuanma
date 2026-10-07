import { createPortal } from 'react-dom'
import { useEffect, useRef } from 'react'
import { create } from 'zustand'
import { haptic } from '../lib/haptic'

/*
 * Confirmaciones y avisos con la forma de iOS (hoja de acciones y alerta).
 * Reemplazan confirm()/alert() del navegador, que en la app instalada muestran
 * la dirección web como título y se sienten de página web.
 */

interface Request {
  id: number
  kind: 'sheet' | 'alert'
  title?: string
  message?: string
  confirm: string
  cancel?: string
  destructive?: boolean
  resolve(ok: boolean): void
}

const useDialog = create<{ req: Request | null; closing: boolean }>(() => ({ req: null, closing: false }))

let seq = 0
const EXIT_MS = 200

function open(r: Omit<Request, 'id' | 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => {
    useDialog.getState().req?.resolve(false)
    useDialog.setState({ req: { ...r, id: ++seq, resolve }, closing: false })
  })
}

function finish(ok: boolean) {
  const { req, closing } = useDialog.getState()
  if (!req || closing) return
  useDialog.setState({ closing: true })
  req.resolve(ok)
  setTimeout(() => {
    if (useDialog.getState().req?.id === req.id) useDialog.setState({ req: null, closing: false })
  }, EXIT_MS)
}

/** Hoja de acciones desde abajo. Resuelve `true` si confirma. */
export function ask(o: { title?: string; message?: string; confirm: string; destructive?: boolean }): Promise<boolean> {
  if (o.destructive) haptic()
  return open({ kind: 'sheet', cancel: 'Cancelar', ...o })
}

/** Alerta centrada con un solo botón, para explicar qué pasó y qué hacer. */
export function tell(o: { title: string; message?: string; confirm?: string }): Promise<void> {
  return open({ kind: 'alert', ...o, confirm: o.confirm ?? 'Entendido' }).then(() => undefined)
}

export function DialogHost() {
  const req = useDialog((s) => s.req)
  const closing = useDialog((s) => s.closing)
  const first = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!req) return
    first.current?.focus({ preventScroll: true })
    // En captura: Escape cierra el diálogo y no la hoja que está debajo
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        finish(false)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [req])

  if (!req) return null
  const state = closing ? 'closing' : ''

  return createPortal(
    <>
      <div className={`dialog-backdrop ${state}`} onClick={() => finish(false)} />
      {req.kind === 'sheet' ? (
        <div
          className={`action-sheet ${state}`}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={req.title ? 'dlg-title' : undefined}
          aria-describedby={req.message ? 'dlg-msg' : undefined}
        >
          <div className="as-group">
            {(req.title || req.message) && (
              <div className="as-head">
                {req.title && <div id="dlg-title">{req.title}</div>}
                {req.message && <p id="dlg-msg">{req.message}</p>}
              </div>
            )}
            <button className={req.destructive ? 'destructive' : ''} onClick={() => finish(true)}>
              {req.confirm}
            </button>
          </div>
          <div className="as-group">
            <button ref={first} className="as-cancel" onClick={() => finish(false)}>
              {req.cancel}
            </button>
          </div>
        </div>
      ) : (
        <div className={`alert ${state}`} role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby="dlg-msg">
          <div className="alert-body">
            <div id="dlg-title" className="alert-title">
              {req.title}
            </div>
            {req.message && (
              <p id="dlg-msg" className="alert-msg">
                {req.message}
              </p>
            )}
          </div>
          <button ref={first} onClick={() => finish(true)}>
            {req.confirm}
          </button>
        </div>
      )}
    </>,
    document.body,
  )
}
