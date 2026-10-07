import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { create } from 'zustand'
import { useStore } from './store'
import { formatMoney, type MoneyOpts } from './lib/format'
import type { Account, Category } from './lib/types'
import { currentMonth, todayISO } from './lib/dates'
import { scroller } from './lib/scroller'
import { inMonth, totalBudget, totals } from './lib/selectors'
import { expectedCurve, fixedSchedule, paceStatus, type PaceStatus } from './lib/pace'

export function useFmt() {
  const locale = useStore((s) => s.settings.locale)
  const currency = useStore((s) => s.settings.currency)
  return useCallback((v: number, o?: MoneyOpts) => formatMoney(v, locale, currency, o), [locale, currency])
}

export function useLocale() {
  return useStore((s) => s.settings.locale)
}

export function useCategoryMap(): Map<string, Category> {
  const categories = useStore((s) => s.categories)
  return useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
}

export function useAccountMap(): Map<string, Account> {
  const accounts = useStore((s) => s.accounts)
  return useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])
}

export interface ToastAction {
  label: string
  run(): void
}

interface ToastState {
  message: string | null
  action: ToastAction | null
  /** Cambia con cada aviso para reiniciar la animación */
  n: number
  show(message: string, action?: ToastAction): void
  hide(): void
}

let timer: ReturnType<typeof setTimeout> | undefined

export const useToast = create<ToastState>()((set) => ({
  message: null,
  action: null,
  n: 0,
  show(message, action) {
    clearTimeout(timer)
    set((s) => ({ message, action: action ?? null, n: s.n + 1 }))
    // Con "Deshacer" se queda más tiempo para alcanzar a tocarlo
    timer = setTimeout(() => set({ message: null, action: null }), action ? 5000 : 2200)
  },
  hide() {
    clearTimeout(timer)
    set({ message: null, action: null })
  },
}))

/** Aviso tipo HUD de iOS. Con acción, muestra un botón (por ejemplo Deshacer). */
export const toast = (m: string, action?: ToastAction) => useToast.getState().show(m, action)

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Número que sube suavemente hasta su valor (los montos grandes "se cuentan"). */
export function useCountUp(target: number, ms = 750): number {
  const [value, setValue] = useState(() => (reducedMotion() ? target : 0))
  const from = useRef(reducedMotion() ? target : 0)
  useEffect(() => {
    const start = from.current
    from.current = target
    if (start === target || reducedMotion()) {
      setValue(target)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(start + (target - start) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return value
}

/**
 * Cómo va el mes (al ritmo esperado, con los fijos en su día). Pinta la luz de arriba
 * de la app: verde si vas bien, ámbar si vas rápido, rojo si ya te pasaste.
 */
export function useMonthMood(): PaceStatus {
  const transactions = useStore((s) => s.transactions)
  const categories = useStore((s) => s.categories)
  const recurrings = useStore((s) => s.recurrings)
  return useMemo(() => {
    const budget = totalBudget(categories)
    if (!budget) return 'ok'
    const month = currentMonth()
    const day = Number(todayISO().slice(8, 10))
    const spent = totals(inMonth(transactions, month)).expense
    const expected = expectedCurve(budget, fixedSchedule(recurrings, month))[day - 1] ?? budget
    return paceStatus(spent, budget, expected)
  }, [transactions, categories, recurrings])
}

/** El header pasa a vidrio cuando el contenido empieza a pasar por debajo. */
export function useScrolled(threshold = 4): boolean {
  const [scrolled, setScrolled] = useState(() => typeof document !== 'undefined' && scroller().scrollTop > threshold)
  useEffect(() => {
    let raf = 0
    const on = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        setScrolled(scroller().scrollTop > threshold)
      })
    }
    const el = scroller()
    el.addEventListener('scroll', on, { passive: true })
    return () => {
      el.removeEventListener('scroll', on)
      cancelAnimationFrame(raf)
    }
  }, [threshold])
  return scrolled
}

/** Tema efectivo: "Automático" sigue al iPhone y cambia en vivo. */
export function useResolvedTheme(theme: 'dark' | 'light' | 'system'): 'dark' | 'light' {
  const query = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: light)') : null
  const [light, setLight] = useState(() => !!query?.matches)
  useEffect(() => {
    if (!query) return
    const on = () => setLight(query.matches)
    query.addEventListener('change', on)
    return () => query.removeEventListener('change', on)
  }, [query])
  return theme === 'system' ? (light ? 'light' : 'dark') : theme
}
