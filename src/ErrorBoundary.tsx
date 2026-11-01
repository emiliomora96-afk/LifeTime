import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { SAVE_KEY } from './data'
import { GAME_KEY } from './game'

interface Props {
  children: ReactNode
  /** Si se indica, un fallo solo oculta esta pieza (muestra esto) y el resto del juego sigue. Si no, sale la pantalla de recuperación. */
  fallback?: ReactNode
  /** Nombre de la pieza, para el mensaje de error */
  name?: string
}
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[Lifetime] error en ${this.props.name ?? 'la app'}:`, error, info.componentStack)
  }

  private resetSave = () => {
    if (!window.confirm('Se borrará la partida y el club guardados en este navegador. ¿Continuar?')) return
    try {
      localStorage.removeItem(SAVE_KEY)
      localStorage.removeItem(GAME_KEY)
    } catch {
      // nada
    }
    window.location.reload()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.fallback !== undefined) return this.props.fallback
    return (
      <div role="alert" style={{ maxWidth: 520, margin: '0 auto', padding: '32px 20px', color: '#e6ecf8', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: '1.4rem', margin: '0 0 8px' }}>Algo salió mal</h1>
        <p style={{ color: '#8fa0c2', lineHeight: 1.4 }}>
          El juego se detuvo por un error. Tu partida sigue guardada: prueba primero «Reintentar». Si vuelve a pasar, puedes
          borrar la partida guardada y empezar de nuevo.
        </p>
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#111a2e', border: '1px solid #223052', borderRadius: 10, padding: 12, fontSize: 14 }}>
          {error.message}
        </pre>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
          <button type="button" className="btn" onClick={() => this.setState({ error: null })}>
            Reintentar
          </button>
          <button type="button" className="btn danger" onClick={this.resetSave}>
            Borrar la partida guardada y empezar de nuevo
          </button>
        </div>
      </div>
    )
  }
}
