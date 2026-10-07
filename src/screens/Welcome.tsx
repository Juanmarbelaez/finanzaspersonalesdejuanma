import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, Eye, EyeOff, Repeat, Share, SquarePlus, Target, Zap } from 'lucide-react'
import { useStore } from '../store'
import { DEFAULT_CATEGORIES } from '../lib/seed'
import { isIOS, isStandalone } from '../lib/download'
import { haptic, hapticSuccess } from '../lib/haptic'
import { scroller } from '../lib/scroller'
import { uid } from '../lib/id'
import { explain, resendConfirmation, resetPassword, saveNow, signIn, signUp, useAuth } from '../lib/cloud'
import type { Account } from '../lib/types'
import { Money } from '../components/ui'
import { Mascot } from '../components/Mascot'
import { Logo } from '../components/Logo'

/*
 * Onboarding en 5 pasos, pensado con los principios de los videos:
 * - Valor antes de pedir algo: se puede mirar con datos de ejemplo sin crear cuenta.
 * - Nunca en 0 %: la barra arranca con "Abriste Plata" ya hecho.
 * - Valores por defecto útiles: cuentas colombianas comunes y presupuestos sugeridos.
 * - Efecto IKEA: eliges tus cuentas y armas tu presupuesto; la app queda tuya.
 * - Errores que dicen cómo arreglarlo.
 */

type Step = 'intro' | 'install' | 'signup' | 'login' | 'forgot' | 'confirm' | 'accounts' | 'budget' | 'building' | 'done'
type Ask = 'name' | 'hello' | 'email' | 'password'

const PROGRESS: Partial<Record<Step, number>> = { signup: 1, login: 1, forgot: 1, confirm: 1, accounts: 2, budget: 3, building: 4, done: 4 }
const TOTAL = 4

interface Option {
  key: string
  name: string
  type: Account['type']
  color: string
}

const ACCOUNT_OPTIONS: Option[] = [
  { key: 'bancolombia', name: 'Bancolombia', type: 'bank', color: '#2B2B2B' },
  { key: 'nequi', name: 'Nequi', type: 'bank', color: '#376642' },
  { key: 'daviplata', name: 'Daviplata', type: 'bank', color: '#000000' },
  { key: 'davivienda', name: 'Davivienda', type: 'bank', color: '#2B2B2B' },
  { key: 'bogota', name: 'Banco de Bogotá', type: 'bank', color: '#376642' },
  { key: 'efectivo', name: 'Efectivo', type: 'cash', color: '#4CA626' },
  { key: 'tarjeta', name: 'Tarjeta de crédito', type: 'credit', color: '#000000' },
]

/** Presupuesto sugerido para empezar (se cambia cuando quieras). */
const SUGGESTED: Record<string, number> = {
  mercado: 800_000,
  restaurantes: 400_000,
  transporte: 300_000,
  servicios: 250_000,
  suscripciones: 100_000,
  compras: 300_000,
  salud: 150_000,
  entretenimiento: 150_000,
}

const digits = (v: string) => Number(v.replace(/\D/g, '').slice(0, 12)) || 0

function MoneyInput({ value, onChange, label }: { value: number; onChange(v: number): void; label: string }) {
  return (
    <span className="ob-money">
      <span className="sym">$</span>
      <input
        inputMode="numeric"
        aria-label={label}
        placeholder="0"
        value={value ? new Intl.NumberFormat('es-CO').format(value) : ''}
        onChange={(e) => onChange(digits(e.target.value))}
      />
    </span>
  )
}

function Progress({ step }: { step: Step }) {
  const at = PROGRESS[step]
  if (!at) return null
  return (
    <div className="ob-progress" role="progressbar" aria-valuemin={0} aria-valuemax={TOTAL} aria-valuenow={at}>
      {Array.from({ length: TOTAL }, (_, i) => (
        <span key={i} className={i < at ? 'on' : ''} />
      ))}
    </div>
  )
}

export function PasswordField({ value, onChange, autoComplete }: { value: string; onChange(v: string): void; autoComplete: string }) {
  const [show, setShow] = useState(false)
  return (
    <label className="ob-field">
      <span>Contraseña</span>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder="Mínimo 8 caracteres"
      />
      <button
        type="button"
        className="ob-eye"
        onClick={() => setShow(!show)}
        aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </label>
  )
}

export function Welcome() {
  const status = useAuth((s) => s.status)
  const [step, setStep] = useState<Step>('intro')
  // Crear cuenta va de a una pregunta por pantalla (como Bevel)
  const [ask, setAsk] = useState<Ask>('name')
  // En iPhone, antes de crear la cuenta se enseña a instalarla (abre a pantalla completa y sin Safari)
  const needsInstall = isIOS() && !isStandalone()
  const [after, setAfter] = useState<Step>('signup')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<{ msg: string; n: number } | null>(null)
  const [busy, setBusy] = useState(false)
  // "Revisa tu correo" sirve para confirmar la cuenta o para cambiar la contraseña
  const [confirmFor, setConfirmFor] = useState<'signup' | 'reset'>('signup')
  const [resendIn, setResendIn] = useState(0)
  const [picked, setPicked] = useState<Record<string, number | false>>({ bancolombia: 0, nequi: 0, efectivo: 0 })
  const [budgets, setBudgets] = useState<Record<string, number>>(SUGGESTED)

  // Si ya hay sesión (cerró la app a mitad del onboarding), sigue donde iba
  useEffect(() => {
    if (status === 'signedIn' && ['intro', 'signup', 'login', 'confirm'].includes(step)) setStep('accounts')
  }, [status, step])

  const fail = (msg: string) => {
    haptic()
    setError((e) => ({ msg, n: (e?.n ?? 0) + 1 }))
  }
  const go = (s: Step) => {
    setError(null)
    setStep(s)
    scroller().scrollTo({ top: 0 })
  }

  // Mientras espera la confirmación: al volver a la app (después de tocar el enlace) entra sola
  const waiting = step === 'confirm' && confirmFor === 'signup' && !!password
  useEffect(() => {
    if (!waiting) return
    let trying = false
    const tryIn = () => {
      if (trying || document.visibilityState !== 'visible') return
      trying = true
      signIn(email.trim(), password)
        .then(() => {
          hapticSuccess()
          if (!useStore.getState().onboarded) go('accounts')
        })
        .catch(() => {}) // Todavía sin confirmar: sigue esperando
        .finally(() => (trying = false))
    }
    document.addEventListener('visibilitychange', tryIn)
    window.addEventListener('focus', tryIn)
    return () => {
      document.removeEventListener('visibilitychange', tryIn)
      window.removeEventListener('focus', tryIn)
    }
  }, [waiting, email, password])

  useEffect(() => {
    if (resendIn <= 0) return
    const id = setTimeout(() => setResendIn((n) => n - 1), 1000)
    return () => clearTimeout(id)
  }, [resendIn])

  const checkConfirmed = async () => {
    if (!password) return go('login')
    setBusy(true)
    try {
      await signIn(email.trim(), password)
      hapticSuccess()
      if (!useStore.getState().onboarded) go('accounts')
    } catch (e) {
      const msg = explain(e)
      fail(/confirmar/.test(msg) ? 'Todavía no aparece confirmado. Abre el enlace del correo y vuelve aquí.' : msg)
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    if (resendIn > 0 || busy) return
    setBusy(true)
    try {
      await resendConfirmation(email.trim())
      haptic()
      setError(null)
      setResendIn(60)
    } catch (e) {
      fail(explain(e))
    } finally {
      setBusy(false)
    }
  }

  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim())

  const submit = async () => {
    if (busy) return
    if (step === 'signup' && !name.trim()) return fail('Escribe tu nombre: así se llamará tu app.')
    if (!validEmail) return fail('Ese correo no se ve bien. Revisa que tenga @ y un punto.')
    if (step === 'forgot') {
      setBusy(true)
      try {
        await resetPassword(email.trim())
        setConfirmFor('reset')
        go('confirm')
      } catch (e) {
        fail(explain(e))
      } finally {
        setBusy(false)
      }
      return
    }
    if (password.length < 8) return fail('La contraseña necesita al menos 8 caracteres.')
    setBusy(true)
    try {
      if (step === 'signup') {
        const r = await signUp(name.trim(), email.trim(), password)
        haptic()
        setConfirmFor('signup')
        setResendIn(60)
        go(r === 'confirm' ? 'confirm' : 'accounts')
      } else {
        await signIn(email.trim(), password)
        haptic()
        // Si la cuenta ya tenía datos, la app abre directo; si no, sigue el onboarding
        if (!useStore.getState().onboarded) go('accounts')
      }
    } catch (e) {
      // Entró sin haber confirmado: se lleva a la pantalla que deja reenviar el correo
      if (step === 'login' && (e as { code?: string })?.code === 'email_not_confirmed') {
        setConfirmFor('signup')
        go('confirm')
      } else fail(explain(e))
    } finally {
      setBusy(false)
    }
  }

  const askReady = ask === 'name' ? !!name.trim() : ask === 'hello' ? true : ask === 'email' ? validEmail : password.length >= 8

  const next = () => {
    if (ask === 'name') return name.trim() ? (haptic(), setAsk('hello')) : fail('Escribe tu nombre: así se llamará tu app.')
    if (ask === 'hello') return setAsk('email')
    if (ask === 'email') return validEmail ? setAsk('password') : fail('Ese correo no se ve bien. Revisa que tenga @ y un punto.')
    submit()
  }

  const total = useMemo(() => Object.values(budgets).reduce((a, b) => a + b, 0), [budgets])
  const displayName = name.trim() || (useStore.getState().settings.name ?? '')

  const finish = () => {
    haptic()
    const accounts: Account[] = ACCOUNT_OPTIONS.filter((o) => picked[o.key] !== undefined && picked[o.key] !== false).map((o) => {
      const bal = (picked[o.key] as number) || 0
      return { id: uid(), name: o.name, type: o.type, color: o.color, startingBalance: o.type === 'credit' ? -bal : bal }
    })
    useStore.getState().completeOnboarding({ name: displayName, accounts, budgets })
    saveNow()
  }

  // Un momento corto de "armando": se siente que la app se prepara para ti
  const build = () => {
    go('building')
    setTimeout(() => setStep((s) => (s === 'building' ? 'done' : s)), 1500)
  }

  const toggleAccount = (key: string) => {
    haptic()
    setPicked((p) => {
      const n = { ...p }
      if (n[key] === undefined || n[key] === false) n[key] = 0
      else n[key] = false
      return n
    })
  }

  const back = (s: Step) => (
    <button className="ob-back" onClick={() => go(s)} aria-label="Atrás">
      <ArrowLeft size={20} />
    </button>
  )

  const errorLine = error && (
    <p key={error.n} className="ob-error shake" role="alert">
      {error.msg}
    </p>
  )

  return (
    <div className="onboarding">
      <div className="sky" aria-hidden />
      <div className="ob-top">
        {step === 'signup' && (
          <button
            className="ob-back"
            onClick={() => {
              setError(null)
              const prev: Record<Ask, Ask | null> = { name: null, hello: 'name', email: 'hello', password: 'email' }
              const p = prev[ask]
              if (p) setAsk(p)
              else go('intro')
            }}
            aria-label="Atrás"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        {step === 'install' && back('intro')}
        {['login', 'forgot', 'confirm'].includes(step) && back(step === 'forgot' ? 'login' : 'intro')}
        {step === 'budget' && back('accounts')}
        <Progress step={step} />
      </div>

      {step === 'intro' && (
        <div className="ob-step" key="intro">
          <div className="ob-hero">
            <div className="ob-brand">
              <Logo size={30} onDark />
              <span>
                <b>Plata</b> de Juanma
              </span>
            </div>
            <Mascot pose="welcome" size={150} className="ob-mascot" />
            <h1 className="display">
              Tu plata,
              <br />
              <b>clara.</b>
            </h1>
            <p className="ob-lead">Gastos, presupuestos y pagos fijos en un solo lugar, sin conectar el banco.</p>
          </div>
          <ul className="feat">
            <li>
              <span className="ic">
                <Zap size={18} />
              </span>
              <span>
                <b>Un gasto en 5 segundos</b>
                Recuerda tus comercios, tu cuenta y tu categoría.
              </span>
            </li>
            <li>
              <span className="ic">
                <Target size={18} />
              </span>
              <span>
                <b>Sabes cuánto te queda</b>
                Te avisa antes de pasarte, contando tus pagos fijos.
              </span>
            </li>
            <li>
              <span className="ic">
                <Repeat size={18} />
              </span>
              <span>
                <b>Pagos fijos en automático</b>
                Arriendo, servicios y suscripciones se anotan solos.
              </span>
            </li>
          </ul>
          <div className="ob-actions">
            <button
              className="ob-primary"
              onClick={() => {
                setAfter('signup')
                go(needsInstall ? 'install' : 'signup')
              }}
            >
              Crear mi cuenta
            </button>
            <button
              className="ob-secondary"
              onClick={() => {
                setAfter('login')
                go(needsInstall ? 'install' : 'login')
              }}
            >
              Ya tengo cuenta
            </button>
            <button className="ob-link" onClick={() => useStore.getState().start('demo')}>
              Mirar primero con datos de ejemplo
            </button>
          </div>
        </div>
      )}

      {step === 'install' && (
        <div className="ob-step" key="install">
          <div className="ob-center">
            <Mascot pose="pointing" size={150} className="ob-mascot center" />
            <h2 className="ob-title center">Primero, tenla como app</h2>
            <p className="ob-sub center">Abre a pantalla completa, sin la barra de Safari, y la encuentras al lado de tus otras apps.</p>
            <ol className="ob-install-steps">
              <li>
                <span className="n">1</span>
                <span>
                  Toca <Share size={17} /> <b>Compartir</b> abajo en Safari
                </span>
              </li>
              <li>
                <span className="n">2</span>
                <span>
                  Baja y elige <SquarePlus size={17} /> <b>Agregar a inicio</b>
                </span>
              </li>
              <li>
                <span className="n">3</span>
                <span>
                  Toca <b>Agregar</b> y ábrela desde tu pantalla de inicio
                </span>
              </li>
            </ol>
          </div>
          <div className="ob-actions">
            <button className="ob-link" onClick={() => go(after)}>
              Seguir aquí en Safari
            </button>
          </div>
        </div>
      )}

      {step === 'signup' && (
        <form
          className="ob-step ob-ask"
          key={ask}
          onSubmit={(e) => {
            e.preventDefault()
            next()
          }}
        >
          {ask === 'hello' ? (
            <div className="ob-center">
              <Mascot pose="success" size={170} className="ob-mascot center" />
              <h2 className="ob-title center">Encantado, {name.trim()}.</h2>
              <p className="ob-sub center">
                Tu app se va a llamar <b>Plata</b> de {name.trim()}. Ahora creamos tu cuenta para que tus datos queden guardados.
              </p>
            </div>
          ) : (
            <div className="ob-center">
              <h2 className="ob-q">
                {ask === 'name' ? '¿Cómo te llamas?' : ask === 'email' ? '¿Cuál es tu correo?' : 'Crea una contraseña'}
              </h2>
              <div className="ob-big">
                {ask === 'name' && (
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      setError(null)
                    }}
                    placeholder="Juanma"
                    autoComplete="given-name"
                    enterKeyHint="next"
                  />
                )}
                {ask === 'email' && (
                  <input
                    autoFocus
                    type="email"
                    inputMode="email"
                    autoCapitalize="none"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setError(null)
                    }}
                    placeholder="tu@correo.com"
                    enterKeyHint="next"
                  />
                )}
                {ask === 'password' && (
                  <input
                    autoFocus
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setError(null)
                    }}
                    placeholder="Mínimo 8 caracteres"
                    enterKeyHint="done"
                  />
                )}
              </div>
              {ask === 'email' && <p className="ob-hint">Lo usas para entrar desde cualquier iPhone o computador.</p>}
              {ask === 'password' && <p className="ob-hint">Solo tú ves tus datos. Nadie más tiene acceso.</p>}
            </div>
          )}
          {errorLine}
          <div className="ob-actions">
            <button className={`ob-primary ${askReady ? '' : 'muted'}`} type="submit" disabled={busy}>
              {busy ? <span className="spinner" aria-label="Cargando" /> : 'Continuar'}
            </button>
            {ask === 'name' && (
              <button type="button" className="ob-link" onClick={() => go('login')}>
                Ya tengo cuenta
              </button>
            )}
          </div>
        </form>
      )}

      {(step === 'login' || step === 'forgot') && (
        <form
          className="ob-step"
          key={step}
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <h2 className="ob-title">{step === 'login' ? 'Hola de nuevo' : 'Recupera tu contraseña'}</h2>
          <p className="ob-sub">
            {step === 'login' ? 'Entra con tu correo y tu contraseña.' : 'Te mandamos un enlace al correo para crear una nueva.'}
          </p>
          <div className="ob-card">
            <label className="ob-field">
              <span>Correo</span>
              <input
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError(null)
                }}
                placeholder="tu@correo.com"
                autoComplete="email"
                autoCapitalize="none"
              />
            </label>
            {step === 'login' && (
              <PasswordField
                value={password}
                onChange={(v) => {
                  setPassword(v)
                  setError(null)
                }}
                autoComplete="current-password"
              />
            )}
          </div>
          {errorLine}
          <div className="ob-actions">
            <button className="ob-primary" type="submit" disabled={busy}>
              {busy ? <span className="spinner" aria-label="Cargando" /> : step === 'login' ? 'Entrar' : 'Enviar enlace'}
            </button>
            {step === 'login' && (
              <button type="button" className="ob-link" onClick={() => go('forgot')}>
                Olvidé mi contraseña
              </button>
            )}
          </div>
        </form>
      )}

      {step === 'confirm' && (
        <div className="ob-step" key="confirm">
          <Mascot pose="pointing" size={180} className="ob-mascot center" />
          <h2 className="ob-title center">Revisa tu correo</h2>
          {confirmFor === 'signup' ? (
            <p className="ob-sub center">
              Te mandamos un enlace a <b>{email.trim()}</b>. Tócalo y vuelve aquí: entras solo. Si no aparece, mira en Spam o Promociones.
            </p>
          ) : (
            <p className="ob-sub center">
              Te mandamos un enlace a <b>{email.trim()}</b> para elegir una contraseña nueva. Después vuelve aquí y entra con ella.
            </p>
          )}
          {errorLine}
          <div className="ob-actions">
            {confirmFor === 'signup' ? (
              <>
                <button className="ob-primary" onClick={checkConfirmed} disabled={busy}>
                  {busy ? 'Revisando…' : 'Ya lo confirmé'}
                </button>
                <button className={`ob-secondary ${resendIn > 0 ? 'muted' : ''}`} onClick={resend} disabled={busy || resendIn > 0}>
                  {resendIn > 0 ? `Reenviar correo en ${resendIn} s` : 'Reenviar correo'}
                </button>
                <button
                  className="ob-link"
                  onClick={() => {
                    setAsk('email')
                    go('signup')
                  }}
                >
                  Me equivoqué de correo
                </button>
              </>
            ) : (
              <button className="ob-primary" onClick={() => go('login')}>
                Entrar
              </button>
            )}
          </div>
        </div>
      )}

      {step === 'accounts' && (
        <div className="ob-step" key="accounts">
          <h2 className="ob-title">¿Dónde tienes tu plata?</h2>
          <p className="ob-sub">Elige tus cuentas y, si quieres, cuánto tienes hoy. Lo puedes ajustar después.</p>
          <div className="ob-chips">
            {ACCOUNT_OPTIONS.map((o) => {
              const on = picked[o.key] !== undefined && picked[o.key] !== false
              return (
                <button key={o.key} className={on ? 'on' : ''} onClick={() => toggleAccount(o.key)} aria-pressed={on}>
                  {on && <Check size={14} strokeWidth={3} />} {o.name}
                </button>
              )
            })}
          </div>
          <div className="ob-card">
            {ACCOUNT_OPTIONS.filter((o) => picked[o.key] !== undefined && picked[o.key] !== false).map((o) => (
              <div className="ob-row" key={o.key}>
                <span className="swatch" style={{ background: o.color }} />
                <span className="n">
                  {o.name}
                  <small>{o.type === 'credit' ? 'Deuda de hoy' : 'Saldo de hoy'}</small>
                </span>
                <MoneyInput
                  value={(picked[o.key] as number) || 0}
                  onChange={(v) => setPicked((p) => ({ ...p, [o.key]: v }))}
                  label={`Saldo de ${o.name}`}
                />
              </div>
            ))}
          </div>
          {errorLine}
          <div className="ob-actions">
            <button
              className="ob-primary"
              onClick={() => (Object.values(picked).some((v) => v !== false) ? go('budget') : fail('Elige al menos una cuenta.'))}
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {step === 'budget' && (
        <div className="ob-step" key="budget">
          <h2 className="ob-title">¿Cuánto quieres gastar al mes?</h2>
          <p className="ob-sub">Te dejamos un presupuesto para empezar. Cámbialo a tu medida o ponlo en 0.</p>
          <div className="ob-total">
            <span className="display num">
              <Money value={total} />
            </span>
            <span className="caption">al mes en estas categorías</span>
          </div>
          <div className="ob-card">
            {DEFAULT_CATEGORIES.filter((c) => c.id in SUGGESTED).map((c) => (
              <div className="ob-row" key={c.id}>
                <span className="e">{c.emoji}</span>
                <span className="n">{c.name}</span>
                <MoneyInput
                  value={budgets[c.id] ?? 0}
                  onChange={(v) => setBudgets((b) => ({ ...b, [c.id]: v }))}
                  label={`Presupuesto de ${c.name}`}
                />
              </div>
            ))}
          </div>
          <div className="ob-actions">
            <button className="ob-primary" onClick={() => build()}>
              Usar este presupuesto
            </button>
            <button
              className="ob-link"
              onClick={() => {
                setBudgets({})
                build()
              }}
            >
              Lo armo después
            </button>
          </div>
        </div>
      )}

      {step === 'building' && (
        <div className="ob-step ob-center" key="building">
          <div className="ob-ring" aria-hidden />
          <h2 className="ob-q">Armando tu plata…</h2>
          <p className="ob-sub center">Tus cuentas, tu presupuesto y tu mes.</p>
        </div>
      )}

      {step === 'done' && (
        <div className="ob-step" key="done">
          <Mascot pose="celebrate" size={220} className="ob-mascot center" />
          <h2 className="ob-title center">Listo{displayName ? `, ${displayName}` : ''}.</h2>
          <p className="ob-sub center">Tu plata ya está guardada en tu cuenta. Anota tu primer gasto y mira cómo va el mes.</p>
          {isIOS() && !isStandalone() && (
            <div className="ob-card ob-install">
              <b>Tenla como app en tu iPhone</b>
              <ol>
                <li>
                  Toca <Share size={15} /> Compartir abajo en Safari
                </li>
                <li>
                  Elige <SquarePlus size={15} /> Agregar a pantalla de inicio
                </li>
              </ol>
            </div>
          )}
          <div className="ob-actions">
            <button className="ob-primary" onClick={finish}>
              Entrar a mi plata
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
