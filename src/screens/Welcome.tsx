import { useState } from 'react'
import { Repeat, Share, Target, Zap } from 'lucide-react'
import { useStore } from '../store'
import { isIOS, isStandalone } from '../lib/download'

export function Welcome() {
  const { start, setSettings } = useStore.getState()
  const [name, setName] = useState('')

  const go = (mode: 'empty' | 'demo') => {
    if (name.trim()) setSettings({ name: name.trim() })
    start(mode)
  }

  return (
    <div className="welcome">
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="logo" aria-hidden>
            P
          </div>
          <span className="eyebrow">Plata de Juanma</span>
        </div>
        <h1 className="display">
          Tu plata,
          <br />
          <span>clara.</span>
        </h1>
        <p className="body">Gastos, presupuestos y pagos fijos en un solo lugar. Sin conectar el banco y sin registrarte: tus datos se quedan en tu teléfono.</p>
        <ul className="feat">
          <li>
            <span className="ic">
              <Zap size={18} />
            </span>
            <span>
              <b>Un gasto en 5 segundos</b>
              Sugiere la categoría según el comercio y recuerda tu última cuenta.
            </span>
          </li>
          <li>
            <span className="ic">
              <Target size={18} />
            </span>
            <span>
              <b>Sabes cuánto te queda</b>
              Presupuesto con el ritmo del mes: te avisa antes de pasarte.
            </span>
          </li>
          <li>
            <span className="ic">
              <Repeat size={18} />
            </span>
            <span>
              <b>Pagos fijos en automático</b>
              Arriendo, servicios y suscripciones se registran solos.
            </span>
          </li>
        </ul>
      </div>

      <div style={{ marginTop: 32 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="¿Cómo te llamas?" aria-label="Tu nombre" autoComplete="given-name" />
        <button className="btn primary" onClick={() => go('empty')}>
          Empezar
        </button>
        <button className="btn ghost" onClick={() => go('demo')}>
          Ver con datos de ejemplo
        </button>
        {isIOS() && !isStandalone() && (
          <p className="caption" style={{ textAlign: 'center', marginTop: 16, color: 'rgba(255,255,255,0.5)', display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
            Tip: <Share size={13} /> Compartir → Agregar a pantalla de inicio
          </p>
        )}
      </div>
    </div>
  )
}
