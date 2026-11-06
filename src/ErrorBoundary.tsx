import { Component, type ReactNode } from 'react'
import { AerisMark } from './components'

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (this.state.failed)
      return (
        <div className="app-loading">
          <AerisMark />
          <span>El espacio necesita volver a cargar.</span>
          <button className="button" onClick={() => location.reload()}>
            Recargar AERIS
          </button>
        </div>
      )
    return this.props.children
  }
}
