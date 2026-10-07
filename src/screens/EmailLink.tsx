import { useState } from 'react'
import { explain, updatePassword, type EmailLink } from '../lib/cloud'
import { isIOS, isStandalone } from '../lib/download'
import { haptic, hapticSuccess } from '../lib/haptic'
import { Mascot } from '../components/Mascot'
import { toast } from '../hooks'
import { PasswordField } from './Welcome'

/*
 * Lo que se ve al abrir un enlace del correo.
 * En iPhone el enlace abre Safari, no la app instalada (no comparten sesión):
 * se confirma aquí y se le dice a la persona que vuelva a Plata.
 */
export function EmailLinkScreen({ kind, onDone }: { kind: Exclude<EmailLink, null>; onDone(): void }) {
  const inSafari = isIOS() && !isStandalone()
  const [password, setPassword] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ msg: string; n: number } | null>(null)

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (password.length < 8) {
      haptic()
      return setError((x) => ({ msg: 'La contraseña necesita al menos 8 caracteres.', n: (x?.n ?? 0) + 1 }))
    }
    setBusy(true)
    try {
      await updatePassword(password)
      hapticSuccess()
      if (inSafari) setSaved(true)
      else {
        toast('Contraseña cambiada')
        onDone()
      }
    } catch (err) {
      haptic()
      setError((x) => ({ msg: explain(err), n: (x?.n ?? 0) + 1 }))
    } finally {
      setBusy(false)
    }
  }

  const backToApp = (title: string, sub: string) => (
    <div className="ob-step" key="back">
      <Mascot pose="success" size={180} className="ob-mascot center" />
      <h2 className="ob-title center">{title}</h2>
      <p className="ob-sub center">{sub}</p>
      <div className="ob-actions">
        <button className="ob-secondary" onClick={onDone}>
          Seguir aquí en Safari
        </button>
      </div>
    </div>
  )

  return (
    <div className="onboarding">
      <div className="sky" aria-hidden />

      {kind === 'signup' &&
        backToApp('Listo, correo confirmado', 'Cierra Safari y abre Plata desde tu pantalla de inicio. Ya entras solo.')}

      {kind === 'recovery' &&
        (saved ? (
          backToApp('Contraseña cambiada', 'Cierra Safari, abre Plata desde tu pantalla de inicio y entra con la nueva.')
        ) : (
          <form className="ob-step" key="newpass" onSubmit={savePassword}>
            <h2 className="ob-title">Elige tu nueva contraseña</h2>
            <p className="ob-sub">Con esta entras desde ahora en todos tus dispositivos.</p>
            <PasswordField value={password} onChange={setPassword} autoComplete="new-password" />
            {error && (
              <p key={error.n} className="ob-error shake" role="alert">
                {error.msg}
              </p>
            )}
            <div className="ob-actions">
              <button className={`ob-primary ${password.length >= 8 ? '' : 'muted'}`} type="submit" disabled={busy}>
                {busy ? 'Guardando…' : 'Guardar contraseña'}
              </button>
            </div>
          </form>
        ))}

      {kind === 'expired' && (
        <div className="ob-step" key="expired">
          <Mascot pose="thinking" size={180} className="ob-mascot center" />
          <h2 className="ob-title center">Ese enlace ya no sirve</h2>
          <p className="ob-sub center">
            Los enlaces del correo duran un rato y sirven una sola vez. Entra con tu correo y contraseña: si falta confirmar, te mandamos
            otro.
          </p>
          <div className="ob-actions">
            <button className="ob-primary" onClick={onDone}>
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
