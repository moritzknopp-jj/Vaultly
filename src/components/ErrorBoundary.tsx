import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  message: string
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error)
    return { hasError: true, message }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[Vaultly] Uncaught render error:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100vh', gap: '16px', background: '#0a0a0a', color: '#f5f5f5', padding: '32px',
          fontFamily: 'system-ui, sans-serif', textAlign: 'center',
        }}>
          <p style={{ fontSize: '32px', margin: 0 }}>⚠</p>
          <h2 style={{ margin: 0, color: '#d4af37' }}>Something went wrong</h2>
          <p style={{ color: '#888', maxWidth: '480px', lineHeight: 1.6 }}>{this.state.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, message: '' })}
            style={{
              padding: '10px 24px', background: '#d4af37', color: '#0a0a0a',
              border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '14px',
            }}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
