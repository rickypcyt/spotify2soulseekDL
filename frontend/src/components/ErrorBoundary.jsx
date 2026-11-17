import { Component } from 'react'

/** Si un componente lanza un error, muestra el mensaje en vez de dejar la página en blanco. */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="min-h-screen bg-[#10121A] p-8 text-[#E9EAF0]">
        <div className="mx-auto max-w-2xl rounded-xl border border-red-400/40 bg-[#161822] p-6">
          <h1 className="text-lg font-semibold">Algo se rompió en la pantalla</h1>
          <p className="mt-2 text-sm text-[#8D93A6]">Tus archivos no se tocaron. Recarga la página para seguir.</p>
          <pre className="mt-4 max-h-60 overflow-auto rounded-lg bg-[#0F1117] p-3 text-xs text-red-200 whitespace-pre-wrap">
            {String(error?.message || error)}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-lg bg-[#FFFFFF] px-5 py-2.5 text-sm font-medium text-[#161822] hover:bg-[#E9EAF0]"
          >
            Recargar
          </button>
        </div>
      </div>
    )
  }
}
