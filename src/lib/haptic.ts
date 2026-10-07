/*
 * Vibración corta, como los "tic" de iOS.
 * Android: navigator.vibrate. iPhone (iOS 18+): Safari no expone vibración, pero activar
 * un <input switch> nativo produce el tic del sistema (si está activa la vibración del sistema).
 */
let label: HTMLLabelElement | null = null
let last = 0

function switchLabel() {
  if (label?.isConnected) return label
  label = document.createElement('label')
  label.setAttribute('aria-hidden', 'true')
  label.style.cssText = 'position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;left:-9px;top:-9px'
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.setAttribute('switch', '')
  input.tabIndex = -1
  label.appendChild(input)
  document.body.appendChild(label)
  return label
}

export function haptic(): void {
  const now = performance.now()
  if (now - last < 45) return // dos toques en el mismo gesto se sienten como uno
  last = now
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator && navigator.vibrate(8)) return
    switchLabel().click()
  } catch {
    // Sin vibración disponible: no pasa nada
  }
}

/** Éxito (guardar, completar): dos toques cortos. */
export function hapticSuccess(): void {
  haptic()
  setTimeout(() => {
    last = 0
    haptic()
  }, 90)
}

/*
 * Toques con vibración en toda la app, sin tener que acordarse en cada botón:
 * pestañas, selectores, botón +, cerrar, confirmaciones, chips y tarjetas que se eligen.
 */
const HAPTIC_TARGETS = [
  '.tabs button',
  '.segmented button',
  '.fab button',
  '.hbtn',
  '.sheet-top .corner',
  '.as-group button',
  '.alert button',
  '.toast-action',
  '.chip-row > *',
  '.suggest button',
  '.acct-card',
  '.ob-primary',
  '.ob-secondary',
  '.ob-back',
  '.ob-chips button',
  '.list-group .item',
  '.action-bar button',
  '.ring-item',
  '.rec-tile',
  '.mini',
  '.cat-line',
  '.tx-row',
  '.review-btn',
].join(',')

export function startHaptics() {
  document.addEventListener(
    'click',
    (e) => {
      if ((e.target as HTMLElement | null)?.closest?.(HAPTIC_TARGETS)) haptic()
    },
    { capture: true },
  )
}
