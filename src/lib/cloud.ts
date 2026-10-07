import type { SupabaseClient } from '@supabase/supabase-js'
import { create } from 'zustand'
import { useStore, type Data } from '../store'

/*
 * Cuentas en la nube (Supabase) con datos local-first:
 * - La app siempre abre y funciona con lo que hay en el teléfono, sin esperar internet.
 * - Cada cambio se guarda en la nube un momento después (un documento por persona).
 * - Si otro dispositivo escribió primero, se mezclan los dos por id y no se pierde nada.
 * El cliente de Supabase se carga aparte, después de pintar, para no hacer más lenta la apertura.
 */

// Claves públicas: la seguridad la dan las políticas RLS (cada quien solo ve su fila)
const URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://rdezmspsvhmuwwbuggwg.supabase.co'
const KEY = import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_sy_1UxIQC5AkT_ZXPbBXeg_8Xa3Mgbd'

const META = 'plata-sync'
const PUSH_DELAY = 1200

type SyncState = 'idle' | 'saving' | 'saved' | 'offline' | 'error'

interface Auth {
  status: 'loading' | 'signedOut' | 'signedIn'
  userId: string | null
  email: string | null
  sync: SyncState
  savedAt: number | null
}

export const useAuth = create<Auth>(() => ({ status: 'loading', userId: null, email: null, sync: 'idle', savedAt: null }))

/** Lo que sabemos de la última sincronización (sobrevive a cerrar la app). */
interface Meta {
  owner: string | null
  remoteAt: string | null
  dirty: boolean
}

const readMeta = (): Meta => {
  try {
    return { owner: null, remoteAt: null, dirty: false, ...JSON.parse(localStorage.getItem(META) || '{}') }
  } catch {
    return { owner: null, remoteAt: null, dirty: false }
  }
}
const writeMeta = (m: Partial<Meta>) => {
  try {
    localStorage.setItem(META, JSON.stringify({ ...readMeta(), ...m }))
  } catch {
    // Sin almacenamiento: se sincroniza igual mientras la app esté abierta
  }
}

let clientPromise: Promise<SupabaseClient> | null = null
export function client(): Promise<SupabaseClient> {
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'plata-auth' } }),
  )
  return clientPromise
}

const DATA_KEYS = ['onboarded', 'demo', 'settings', 'accounts', 'categories', 'transactions', 'recurrings', 'merchantRules'] as const

export function snapshot(): Data {
  const s = useStore.getState()
  return Object.fromEntries(DATA_KEYS.map((k) => [k, s[k]])) as unknown as Data
}

/** Une dos versiones por id. Ante el mismo id gana la de este teléfono. */
export function mergeData(local: Data, remote: Data): Data {
  const byId = <T extends { id: string }>(a: T[], b: T[]) => {
    const map = new Map(b.map((x) => [x.id, x]))
    for (const x of a) map.set(x.id, x)
    return [...map.values()]
  }
  return {
    ...remote,
    ...local,
    onboarded: local.onboarded || remote.onboarded,
    demo: false,
    settings: { ...remote.settings, ...local.settings },
    accounts: byId(local.accounts, remote.accounts),
    categories: byId(local.categories, remote.categories),
    transactions: byId(local.transactions, remote.transactions),
    recurrings: byId(local.recurrings, remote.recurrings),
    merchantRules: { ...remote.merchantRules, ...local.merchantRules },
  }
}

/** Hay datos propios de verdad (no demo, no una app recién abierta). */
const hasRealData = (d: Data) => d.onboarded && !d.demo && (d.transactions.length > 0 || d.accounts.some((a) => a.startingBalance !== 0))

let applyingRemote = false
function applyRemote(data: Data) {
  applyingRemote = true
  useStore.getState().restore({ ...data, demo: false })
  applyingRemote = false
}

async function pull(): Promise<{ data: Data; updatedAt: string } | null> {
  const sb = await client()
  const { data, error } = await sb.from('plata_state').select('data, updated_at').maybeSingle()
  if (error) throw error
  return data ? { data: data.data as Data, updatedAt: data.updated_at as string } : null
}

let pushing: Promise<void> | null = null
let timer: ReturnType<typeof setTimeout> | undefined

/** Guarda en la nube. Si otro dispositivo escribió primero, mezcla y vuelve a intentar. */
async function push(): Promise<void> {
  const { userId } = useAuth.getState()
  const local = snapshot()
  if (!userId || local.demo || !local.onboarded) return
  if (!navigator.onLine) return void useAuth.setState({ sync: 'offline' })
  useAuth.setState({ sync: 'saving' })
  const sb = await client()
  const { remoteAt } = readMeta()
  try {
    let updatedAt: string | null = null
    if (remoteAt) {
      const { data, error } = await sb
        .from('plata_state')
        .update({ data: local })
        .eq('user_id', userId)
        .eq('updated_at', remoteAt)
        .select('updated_at')
      if (error) throw error
      updatedAt = data?.[0]?.updated_at ?? null
    } else {
      const { data, error } = await sb.from('plata_state').insert({ user_id: userId, data: local }).select('updated_at')
      if (!error) updatedAt = data?.[0]?.updated_at ?? null
      else if (error.code !== '23505') throw error // 23505: ya existía (otro dispositivo)
    }
    if (!updatedAt) {
      // Conflicto: alguien guardó antes. Se unen las dos versiones y se guarda el resultado.
      const remote = await pull()
      if (remote) {
        applyRemote(mergeData(snapshot(), remote.data))
        writeMeta({ remoteAt: remote.updatedAt })
        return push()
      }
      writeMeta({ remoteAt: null })
      return push()
    }
    writeMeta({ remoteAt: updatedAt, dirty: false, owner: userId })
    useAuth.setState({ sync: 'saved', savedAt: Date.now() })
  } catch {
    useAuth.setState({ sync: navigator.onLine ? 'error' : 'offline' })
  }
}

export function flush(): Promise<void> {
  clearTimeout(timer)
  pushing = (pushing ?? Promise.resolve()).then(push, push)
  return pushing
}

function schedule() {
  clearTimeout(timer)
  timer = setTimeout(flush, PUSH_DELAY)
}

/** Al entrar en un dispositivo: decide qué datos quedan sin perder nada. */
async function reconcile(userId: string) {
  const meta = readMeta()
  const local = snapshot()
  const remote = await pull()
  const mine = meta.owner === userId
  if (!remote) {
    writeMeta({ owner: userId, remoteAt: null, dirty: true })
    if (hasRealData(local)) await flush()
    return
  }
  if (mine && meta.dirty) {
    // Cambios de este teléfono que no alcanzaron a subir: se unen con la nube
    applyRemote(mergeData(local, remote.data))
  } else if (!mine && hasRealData(local) && meta.owner === null) {
    // Datos que ya tenías antes de crear la cuenta: se suman a los de la nube
    applyRemote(mergeData(local, remote.data))
  } else {
    applyRemote(remote.data)
  }
  writeMeta({ owner: userId, remoteAt: remote.updatedAt, dirty: mine && meta.dirty })
  if (readMeta().dirty || !mine) await flush()
}

let started = false

/** Arranca la sesión guardada, escucha cambios de datos y vuelve a mirar la nube al volver a la app. */
export async function startCloud() {
  if (started) return
  started = true
  const sb = await client()
  const { data } = await sb.auth.getSession()
  const user = data.session?.user
  if (user) {
    useAuth.setState({ status: 'signedIn', userId: user.id, email: user.email ?? null })
    reconcile(user.id).catch(() => useAuth.setState({ sync: navigator.onLine ? 'error' : 'offline' }))
  } else {
    useAuth.setState({ status: 'signedOut' })
  }

  useStore.subscribe((s, prev) => {
    if (applyingRemote || s === prev || !useAuth.getState().userId) return
    if (DATA_KEYS.every((k) => s[k] === prev[k])) return
    writeMeta({ dirty: true })
    schedule()
  })

  document.addEventListener('visibilitychange', () => {
    const { userId } = useAuth.getState()
    if (!userId) return
    if (document.visibilityState === 'hidden') {
      if (readMeta().dirty) flush()
      return
    }
    // Al volver: si otro dispositivo cambió algo, se trae
    if (!readMeta().dirty)
      pull()
        .then((r) => {
          if (r && r.updatedAt !== readMeta().remoteAt) {
            applyRemote(r.data)
            writeMeta({ remoteAt: r.updatedAt })
          }
        })
        .catch(() => {})
  })
  window.addEventListener('online', () => readMeta().dirty && flush())
}

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'El correo o la contraseña no coinciden. Revísalos o recupera la contraseña.',
  email_not_confirmed: 'Falta confirmar tu correo: abre el enlace que te llegó y vuelve a intentar.',
  user_already_exists: 'Ya hay una cuenta con ese correo. Entra con tu contraseña.',
  weak_password: 'La contraseña es muy débil: usa al menos 8 caracteres, con letras y números.',
  over_email_send_rate_limit: 'Se enviaron muchos correos seguidos. Espera un minuto y vuelve a intentar.',
  over_request_rate_limit: 'Demasiados intentos seguidos. Espera un minuto.',
}

/** Errores que dicen qué hacer, no "Error 400". */
export function explain(e: unknown): string {
  const err = e as { code?: string; message?: string }
  if (!navigator.onLine) return 'No hay internet. Conéctate y vuelve a intentar.'
  if (err?.code && MESSAGES[err.code]) return MESSAGES[err.code]
  if (/already registered/i.test(err?.message ?? '')) return MESSAGES.user_already_exists
  if (/invalid login/i.test(err?.message ?? '')) return MESSAGES.invalid_credentials
  if (/email not confirmed/i.test(err?.message ?? '')) return MESSAGES.email_not_confirmed
  return 'No se pudo completar. Revisa tu conexión y vuelve a intentar.'
}

async function signedIn(userId: string, email: string | null) {
  useAuth.setState({ status: 'signedIn', userId, email })
  await reconcile(userId)
}

/** Crea la cuenta. Si el proyecto pide confirmar el correo, devuelve 'confirm'. */
export async function signUp(name: string, email: string, password: string): Promise<'ok' | 'confirm'> {
  const sb = await client()
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { name }, emailRedirectTo: window.location.origin + window.location.pathname },
  })
  if (error) throw error
  // Con confirmación desactivada, un correo repetido vuelve sin identidades
  if (data.user && data.user.identities?.length === 0) throw { code: 'user_already_exists' }
  if (!data.session || !data.user) return 'confirm'
  await signedIn(data.user.id, data.user.email ?? email)
  return 'ok'
}

export async function signIn(email: string, password: string): Promise<void> {
  const sb = await client()
  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  if (error) throw error
  await signedIn(data.user.id, data.user.email ?? email)
}

export async function resetPassword(email: string): Promise<void> {
  const sb = await client()
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname })
  if (error) throw error
}

/** Sale y deja el teléfono limpio (útil si lo comparten). Antes guarda lo pendiente. */
export async function signOut(): Promise<void> {
  if (readMeta().dirty) await flush().catch(() => {})
  const sb = await client()
  await sb.auth.signOut().catch(() => {})
  writeMeta({ owner: null, remoteAt: null, dirty: false })
  applyingRemote = true
  useStore.getState().resetAll()
  applyingRemote = false
  useAuth.setState({ status: 'signedOut', userId: null, email: null, sync: 'idle', savedAt: null })
}

/** Al terminar el onboarding: sube el primer documento. */
export function saveNow() {
  writeMeta({ dirty: true })
  return flush()
}
