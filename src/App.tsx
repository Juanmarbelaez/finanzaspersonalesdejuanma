import { createPortal } from 'react-dom'
import { useEffect, useLayoutEffect, useRef, useState, type TouchEvent } from 'react'
import { Check, FileUp, Plus, Settings2, SlidersHorizontal, X } from 'lucide-react'
import { TABS, useStore, useUI, type Tab } from './store'
import { useMonthMood, useResolvedTheme, useScrolled, useToast } from './hooks'
import { haptic } from './lib/haptic'
import { Dashboard } from './screens/Dashboard'
import { Transactions } from './screens/Transactions'
import { Categories } from './screens/Categories'
import { Recurrings } from './screens/Recurrings'
import { CashFlow } from './screens/CashFlow'
import { Accounts } from './screens/Accounts'
import { Welcome } from './screens/Welcome'
import { SheetHost } from './sheets/SheetHost'
import { DialogHost, ask } from './components/Dialog'
import { emailLink, startCloud } from './lib/cloud'
import { isIOS, isStandalone } from './lib/download'
import { EmailLinkScreen } from './screens/EmailLink'
import { scroller } from './lib/scroller'
import { Logo } from './components/Logo'

const SCREENS: Record<Tab, () => React.JSX.Element> = {
  dashboard: Dashboard,
  transactions: Transactions,
  categories: Categories,
  recurrings: Recurrings,
  cashflow: CashFlow,
  accounts: Accounts,
}

/**
 * Pestañas con una lente de vidrio que se desliza a la elegida.
 * Si dejas el dedo un momento y deslizas, la lente te sigue y al soltar cambia de pestaña
 * (como la barra de iOS 26). Un deslizamiento rápido sigue siendo scroll normal.
 */
function TabPills() {
  const tab = useUI((s) => s.tab)
  const setTab = useUI((s) => s.setTab)
  const ref = useRef<HTMLDivElement>(null)
  const lens = useRef<HTMLSpanElement>(null)
  const [hover, setHover] = useState<Tab | null>(null)

  const place = (btn: HTMLElement | null | undefined, dragX?: number) => {
    const l = lens.current
    if (!l || !btn) return
    const x = dragX ?? btn.offsetLeft
    l.style.transform = `translate(${x}px, ${btn.offsetTop}px)`
    l.style.width = `${btn.offsetWidth}px`
    l.style.height = `${btn.offsetHeight}px`
  }

  // La lente va a la pestaña activa y esa pestaña queda centrada a la vista
  useLayoutEffect(() => {
    const el = ref.current?.querySelector<HTMLButtonElement>(`button[data-tab="${tab}"]`)
    place(el)
    // Solo mueve la fila de pestañas (scrollIntoView también movía la pantalla)
    const nav = ref.current
    if (el && nav && nav.scrollWidth > nav.clientWidth)
      nav.scrollTo({ left: el.offsetLeft - (nav.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' })
  }, [tab])

  // Re-ubica la lente cuando carga la fuente o cambia el tamaño
  useEffect(() => {
    const re = () => place(ref.current?.querySelector<HTMLButtonElement>(`button[data-tab="${useUI.getState().tab}"]`))
    document.fonts?.ready.then(re)
    window.addEventListener('resize', re)
    return () => window.removeEventListener('resize', re)
  }, [])

  // Mantener presionado y deslizar
  useEffect(() => {
    const nav = ref.current
    if (!nav) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let dragging = false
    let startX = 0
    let startY = 0
    let over: Tab | null = null

    const buttonAt = (clientX: number) => {
      const btns = [...nav.querySelectorAll<HTMLButtonElement>('button[data-tab]')]
      return (
        btns.find((b) => {
          const r = b.getBoundingClientRect()
          return clientX >= r.left - 2 && clientX <= r.right + 2
        }) ?? null
      )
    }
    const follow = (clientX: number) => {
      const btn = buttonAt(clientX)
      const l = lens.current
      if (!l) return
      const navRect = nav.getBoundingClientRect()
      const w = l.offsetWidth
      const x = clientX - navRect.left + nav.scrollLeft - w / 2
      place(btn ?? nav.querySelector('button.active'), Math.max(0, x))
      const id = (btn?.dataset.tab as Tab | undefined) ?? null
      if (id && id !== over) {
        over = id
        haptic()
        setHover(id)
      }
    }
    const start = (x: number, y: number) => {
      startX = x
      startY = y
      clearTimeout(timer)
      timer = setTimeout(() => {
        dragging = true
        nav.classList.add('lens-drag')
        haptic()
        follow(startX)
      }, 180)
    }
    const move = (x: number, y: number, e: Event) => {
      if (dragging) {
        if (e.cancelable) e.preventDefault()
        follow(x)
      } else if (Math.abs(x - startX) > 8 || Math.abs(y - startY) > 8) clearTimeout(timer)
    }
    const end = () => {
      clearTimeout(timer)
      if (!dragging) return
      dragging = false
      nav.classList.remove('lens-drag')
      const id = over
      over = null
      setHover(null)
      // Siempre vuelve a una pestaña (aunque sueltes sobre la misma en la que estabas)
      if (id) setTab(id)
      place(nav.querySelector<HTMLElement>(`button[data-tab="${id ?? useUI.getState().tab}"]`))
      // El clic que llega después de soltar no debe repetir la acción
      const stop = (ev: Event) => {
        ev.stopPropagation()
        ev.preventDefault()
      }
      nav.addEventListener('click', stop, { capture: true, once: true })
      setTimeout(() => nav.removeEventListener('click', stop, { capture: true }), 50)
    }
    const ts = (e: globalThis.TouchEvent) => start(e.touches[0].clientX, e.touches[0].clientY)
    const tm = (e: globalThis.TouchEvent) => move(e.touches[0].clientX, e.touches[0].clientY, e)
    const pd = (e: PointerEvent) => e.pointerType === 'mouse' && start(e.clientX, e.clientY)
    const pm = (e: PointerEvent) => e.pointerType === 'mouse' && e.buttons === 1 && move(e.clientX, e.clientY, e)
    const pu = (e: PointerEvent) => e.pointerType === 'mouse' && end()
    nav.addEventListener('touchstart', ts, { passive: true })
    nav.addEventListener('touchmove', tm, { passive: false })
    nav.addEventListener('touchend', end)
    nav.addEventListener('touchcancel', end)
    nav.addEventListener('pointerdown', pd)
    window.addEventListener('pointermove', pm)
    window.addEventListener('pointerup', pu)
    return () => {
      clearTimeout(timer)
      nav.removeEventListener('touchstart', ts)
      nav.removeEventListener('touchmove', tm)
      nav.removeEventListener('touchend', end)
      nav.removeEventListener('touchcancel', end)
      nav.removeEventListener('pointerdown', pd)
      window.removeEventListener('pointermove', pm)
      window.removeEventListener('pointerup', pu)
    }
  }, [setTab])

  return (
    <nav className="tabs" ref={ref} aria-label="Secciones">
      <span className="tab-lens glass" ref={lens} aria-hidden />
      {TABS.map((t) => (
        <button
          key={t.id}
          data-tab={t.id}
          className={`${tab === t.id ? 'active' : ''} ${hover === t.id ? 'hover' : ''}`}
          aria-current={tab === t.id ? 'page' : undefined}
          onClick={() => setTab(t.id)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  )
}

function Fab() {
  const tab = useUI((s) => s.tab)
  const openSheet = useUI((s) => s.openSheet)
  const add = () => {
    if (tab === 'recurrings') openSheet({ name: 'recurringEdit' })
    else if (tab === 'accounts') openSheet({ name: 'accountEdit' })
    else openSheet({ name: 'tx' })
  }
  return (
    <div className="fab">
      {tab === 'categories' && (
        <button onClick={() => openSheet({ name: 'categoriesManage' })} aria-label="Editar categorías">
          <SlidersHorizontal size={20} />
        </button>
      )}
      <button className="primary" onClick={add} aria-label="Agregar">
        <Plus size={24} />
      </button>
    </div>
  )
}

/** Aviso tipo HUD de iOS: baja desde arriba, junto a la isla dinámica. */
function Toast() {
  const { message, action, n, hide } = useToast()
  if (!message) return null
  return createPortal(
    <div className="toast" role="status" key={n}>
      <span className="toast-dot" aria-hidden>
        <Check size={13} strokeWidth={3.2} />
      </span>
      <span>{message}</span>
      {action && (
        <button
          className="toast-action"
          onClick={() => {
            haptic()
            action.run()
            hide()
          }}
        >
          {action.label}
        </button>
      )}
    </div>,
    document.body,
  )
}

/** Deslizar a los lados cambia de pestaña, como en Copilot (sin pelear con los carruseles). */
function useSwipeTabs() {
  const start = useRef<{ x: number; y: number; t: number } | null>(null)
  const onTouchStart = (e: TouchEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('.rings, .upcoming, .acct-scroll, .tabs, .chart, input, select, .suggest')) {
      start.current = null
      return
    }
    start.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      t: Date.now(),
    }
  }
  const onTouchEnd = (e: TouchEvent) => {
    const s = start.current
    start.current = null
    if (!s || useUI.getState().sheets.some((x) => !x.closing)) return
    const dx = e.changedTouches[0].clientX - s.x
    const dy = e.changedTouches[0].clientY - s.y
    if (Math.abs(dx) < 70 || Math.abs(dy) > 50 || Date.now() - s.t > 600) return
    const { tab, setTab } = useUI.getState()
    const i = TABS.findIndex((t) => t.id === tab)
    const next = TABS[i + (dx < 0 ? 1 : -1)]
    if (next) {
      haptic()
      setTab(next.id)
    }
  }
  return { onTouchStart, onTouchEnd }
}

export function App() {
  const onboarded = useStore((s) => s.onboarded)
  const theme = useStore((s) => s.settings.theme)
  const demo = useStore((s) => s.demo)
  const tab = useUI((s) => s.tab)
  const openSheet = useUI((s) => s.openSheet)
  const sheetOpen = useUI((s) => s.sheets.some((x) => !x.closing))
  const appRef = useRef<HTMLDivElement>(null)
  const swipe = useSwipeTabs()
  const scrolled = useScrolled()
  const mood = useMonthMood()
  const resolved = useResolvedTheme(theme)
  const name = useStore((s) => s.settings.name.trim())

  // Enlace del correo: en computador o en la app instalada se sigue normal; en Safari del iPhone se avisa
  const [link, setLink] = useState(() => (emailLink === 'signup' && !(isIOS() && !isStandalone()) ? null : emailLink))

  // La nube arranca después de pintar: la app abre al instante con lo del teléfono
  useEffect(() => {
    const id = setTimeout(() => startCloud(), 0)
    return () => clearTimeout(id)
  }, [])

  // Cada quien tiene su app: "Plata de Juanma", "Plata de Mamá"… (también al agregarla al inicio)
  useEffect(() => {
    const title = name ? `Plata de ${name}` : 'Plata'
    document.title = title
    document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', title)
  }, [name])

  // Efecto de hoja de iOS: la pantalla de atrás se encoge desde lo que estás viendo
  useLayoutEffect(() => {
    if (sheetOpen && appRef.current) appRef.current.style.transformOrigin = `50% ${scroller().scrollTop + 40}px`
  }, [sheetOpen])

  useEffect(() => {
    document.documentElement.dataset.theme = resolved
  }, [resolved])

  // Los pagos recurrentes que ya vencieron se registran solos al abrir la app
  useEffect(() => {
    const run = () => document.visibilityState === 'visible' && useStore.getState().processRecurrings()
    run()
    document.addEventListener('visibilitychange', run)
    return () => document.removeEventListener('visibilitychange', run)
  }, [onboarded])

  useEffect(() => {
    scroller().scrollTo({ top: 0 })
  }, [tab, onboarded])

  if (link)
    return (
      <>
        <EmailLinkScreen kind={link} onDone={() => setLink(null)} />
        <DialogHost />
      </>
    )

  if (!onboarded)
    return (
      <>
        <Welcome />
        <DialogHost />
      </>
    )

  const Screen = SCREENS[tab]

  const exitDemo = async () => {
    const ok = await ask({
      title: 'Salir del modo demo',
      message: 'Se borran los datos de ejemplo y empiezas con los tuyos.',
      confirm: 'Borrar datos de ejemplo',
      destructive: true,
    })
    if (ok) useStore.getState().resetAll()
  }

  return (
    <>
      <div className={`app ${sheetOpen ? 'pushed' : ''} ${demo ? 'demo' : ''}`} data-mood={mood} ref={appRef}>
        {/* Luz de arriba: el color dice cómo va el mes */}
        <div className="sky" aria-hidden />
        {demo && (
          <div className="demo-banner">
            Estás en modo demo
            <button aria-label="Salir del modo demo" onClick={exitDemo}>
              <X size={16} strokeWidth={2.4} />
            </button>
          </div>
        )}
        <header className={`app-header ${scrolled ? 'scrolled' : ''}`}>
          <div className="title-row">
            <button className="hbtn" onClick={() => openSheet({ name: 'settings' })} aria-label="Ajustes">
              <Settings2 size={21} />
            </button>
            <h1 className="wordmark">
              <Logo size={24} className="wm-logo" />
              <b>Plata</b>
              {name ? ` de ${name}` : ''}
              <i>.</i>
            </h1>
            <button className="hbtn" onClick={() => openSheet({ name: 'import' })} aria-label="Importar extracto">
              <FileUp size={21} />
            </button>
          </div>
          <TabPills />
        </header>
        <main onTouchStart={swipe.onTouchStart} onTouchEnd={swipe.onTouchEnd}>
          <Screen key={tab} />
        </main>
        <Fab />
      </div>
      <SheetHost />
      <DialogHost />
      <Toast />
    </>
  )
}
