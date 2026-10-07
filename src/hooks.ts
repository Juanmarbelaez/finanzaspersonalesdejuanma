import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { create } from 'zustand'
import { useStore } from './store'
import { formatMoney, type MoneyOpts } from './lib/format'
import type { Account, Category } from './lib/types'

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

interface ToastState {
  message: string | null
  show(message: string): void
}

let timer: ReturnType<typeof setTimeout> | undefined

export const useToast = create<ToastState>()((set) => ({
  message: null,
  show(message) {
    clearTimeout(timer)
    set({ message })
    timer = setTimeout(() => set({ message: null }), 2200)
  },
}))

export const toast = (m: string) => useToast.getState().show(m)

const reducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

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
