/**
 * Vibración corta de confirmación.
 * Android: navigator.vibrate. iPhone (iOS 18+): Safari no expone vibración,
 * pero activar un <input switch> nativo produce el "tic" del sistema.
 */
export function haptic(): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator && navigator.vibrate(8)) return
    const label = document.createElement('label')
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.setAttribute('switch', '')
    label.style.display = 'none'
    label.appendChild(input)
    document.body.appendChild(label)
    label.click()
    label.remove()
  } catch {
    // Sin vibración disponible: no pasa nada
  }
}
