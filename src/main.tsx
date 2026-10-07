import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/montserrat/wght.css'
import './styles.css'
import { App } from './App'
import { startHaptics } from './lib/haptic'
import { ErrorBoundary } from './components/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

// Safari ignora user-scalable: el pellizco se bloquea con sus eventos de gesto
for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false })

// Alto del teclado: los botones del onboarding se suben para quedar encima
const vv = window.visualViewport
if (vv) {
  const kb = () => document.documentElement.style.setProperty('--kb', `${Math.max(0, window.innerHeight - vv.height - vv.offsetTop)}px`)
  vv.addEventListener('resize', kb)
  vv.addEventListener('scroll', kb)
}

// Las poses de la mascota se descargan apenas abre la app, para que aparezcan suaves
setTimeout(() => {
  for (const pose of ['welcome', 'success', 'celebrate', 'pointing', 'empty', 'review', 'thinking']) {
    const img = new Image()
    img.src = `./moneymaxxer/${pose}.webp`
  }
}, 1200)

// Como app nativa: sin menú de "mantener presionado" fuera de los campos de texto
const inField = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.('input, textarea')
document.addEventListener('contextmenu', (e) => {
  if (!inField(e.target)) e.preventDefault()
})
// Si iOS igual empieza a seleccionar texto fuera de un campo, se cancela
document.addEventListener('selectstart', (e) => {
  if (!inField(e.target)) e.preventDefault()
})
document.addEventListener('selectionchange', () => {
  const sel = getSelection()
  if (sel && !sel.isCollapsed && !inField(document.activeElement) && !inField(sel.anchorNode?.parentElement ?? null)) sel.removeAllRanges()
})

// Refracción real del vidrio solo donde el navegador la soporta (Chrome/Edge en computador)
if (/Chrome\//.test(navigator.userAgent) && !/Mobile|Android|CriOS|EdgiOS/.test(navigator.userAgent))
  document.documentElement.classList.add('lg-refract')

startHaptics()

// Funciona sin internet una vez instalada
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}

// Pide a Safari que no borre los datos por falta de espacio
navigator.storage?.persist?.().catch(() => {})
