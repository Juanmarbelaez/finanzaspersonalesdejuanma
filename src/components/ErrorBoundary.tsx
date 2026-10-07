import { Component, type ReactNode } from 'react'
import { saveFile } from '../lib/download'
import { todayISO } from '../lib/dates'

/*
 * Si algo se rompe al pintar, en vez de pantalla negra sale esto.
 * Lo primero es que los datos no se pierdan: se pueden descargar tal como están guardados.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error(error)
  }

  private download = () => {
    let raw = '{}'
    try {
      raw = localStorage.getItem('plata') ?? '{}'
    } catch {
      // Sin acceso al almacenamiento: se descarga vacío
    }
    void saveFile(`plata-rescate-${todayISO()}.json`, 'application/json', raw)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="onboarding rescue">
        <div className="ob-step">
          <h1 className="ob-title">Algo se trabó</h1>
          <p className="ob-sub">
            Tus datos siguen guardados en este teléfono. Vuelve a intentar y, si sigue pasando, descárgalos para no perder nada.
          </p>
        </div>
        <div className="ob-actions">
          <button className="ob-primary" onClick={() => location.reload()}>
            Volver a intentar
          </button>
          <button className="ob-secondary" onClick={this.download}>
            Descargar mis datos
          </button>
        </div>
      </div>
    )
  }
}
