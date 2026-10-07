import { useState } from 'react'
import { useStore, useUI } from '../store'
import { toast } from '../hooks'
import { haptic } from '../lib/haptic'
import { explain, signIn, signUp } from '../lib/cloud'
import { Sheet } from '../components/Sheet'
import { Segmented } from '../components/ui'

/**
 * Para quien ya usaba la app sin cuenta: crea una (o entra) y sus datos de este
 * iPhone se suben y se unen con lo que haya en la nube. No se pierde nada.
 */
export function AuthSheet() {
  const { closeSheet } = useUI.getState()
  const settingsName = useStore((s) => s.settings.name)
  const [mode, setMode] = useState<'signup' | 'login'>('signup')
  const [name, setName] = useState(settingsName)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<{ msg: string; n: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const fail = (msg: string) => {
    haptic()
    setError((e) => ({ msg, n: (e?.n ?? 0) + 1 }))
  }

  const submit = async () => {
    if (busy) return
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return fail('Ese correo no se ve bien. Revisa que tenga @ y un punto.')
    if (password.length < 8) return fail('La contraseña necesita al menos 8 caracteres.')
    setBusy(true)
    try {
      if (mode === 'signup') {
        if (name.trim()) useStore.getState().setSettings({ name: name.trim() })
        const r = await signUp(name.trim(), email.trim(), password)
        if (r === 'confirm') return setSent(true)
      } else {
        await signIn(email.trim(), password)
      }
      haptic()
      toast('Tus datos ya están en la nube')
      closeSheet()
    } catch (e) {
      fail(explain(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      title="Tu cuenta"
      footer={
        !sent && (
          <button className="save-bar" onClick={submit} disabled={busy}>
            {busy ? 'Un momento…' : mode === 'signup' ? 'Crear cuenta' : 'Entrar'}
          </button>
        )
      }
      footerBar
    >
      {sent ? (
        <p className="body" style={{ textAlign: 'center', marginTop: 24 }}>
          Te mandamos un enlace a <b>{email.trim()}</b>. Ábrelo y vuelve aquí para entrar con tu contraseña.
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <Segmented<'signup' | 'login'>
            value={mode}
            onChange={(m) => {
              setError(null)
              setMode(m)
            }}
            options={[
              { value: 'signup', label: 'Crear cuenta' },
              { value: 'login', label: 'Ya tengo' },
            ]}
          />
          <p className="caption" style={{ textAlign: 'center', margin: '14px 8px 16px' }}>
            Lo que tienes en este iPhone se sube a tu cuenta y queda guardado. Solo tú lo ves.
          </p>
          <div className="list-group">
            {mode === 'signup' && (
              <div className="kv">
                <label className="k" htmlFor="au-name">
                  Nombre
                </label>
                <input id="au-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Juanma" autoComplete="given-name" />
              </div>
            )}
            <div className="kv">
              <label className="k" htmlFor="au-email">
                Correo
              </label>
              <input
                id="au-email"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
              />
            </div>
            <div className="kv">
              <label className="k" htmlFor="au-pass">
                Contraseña
              </label>
              <input
                id="au-pass"
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8"
              />
            </div>
          </div>
          {error && (
            <p key={error.n} className="caption neg shake" role="alert" style={{ textAlign: 'center', marginTop: 12 }}>
              {error.msg}
            </p>
          )}
          <button type="submit" hidden />
        </form>
      )}
    </Sheet>
  )
}
