import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/montserrat/wght.css'
import './styles.css'
import { App } from './App'
import { startOverscrollColor } from './lib/overscroll'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

startOverscrollColor()

// Safari ignora user-scalable: el pellizco se bloquea con sus eventos de gesto
for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false })

// Funciona sin internet una vez instalada
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}

// Pide a Safari que no borre los datos por falta de espacio
navigator.storage?.persist?.().catch(() => {})
