/*
 * Al estirar la pantalla en iPhone (rebote), iOS muestra el color de fondo de la página.
 * Arriba debe verse el cielo verde (no un bloque negro) y abajo el fondo normal:
 * el fondo de <html> cambia según la mitad de la página en la que estés.
 */
const SKY = { dark: '#30593a', light: '#376642' }

function paint() {
  const root = document.documentElement
  const light = root.dataset.theme === 'light'
  const nearTop = window.scrollY < (root.scrollHeight - window.innerHeight) / 2 || root.scrollHeight <= window.innerHeight * 1.2
  // En modo demo arriba va la franja negra del aviso
  const demo = !!document.querySelector('.app.demo')
  const top = demo ? '#000000' : light ? SKY.light : SKY.dark
  const color = nearTop ? top : light ? '#f5f5f5' : '#000000'
  if (root.style.backgroundColor !== color) root.style.backgroundColor = color
}

let raf = 0
const schedule = () => {
  if (!raf)
    raf = requestAnimationFrame(() => {
      raf = 0
      paint()
    })
}

export function startOverscrollColor() {
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', schedule)
  // Cambios de tema, de pantalla o de modo demo
  new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
  paint()
}
