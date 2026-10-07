import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/montserrat/wght.css'
import './styles.css'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
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

// Funciona sin internet una vez instalada
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}

// Pide a Safari que no borre los datos por falta de espacio
navigator.storage?.persist?.().catch(() => {})
