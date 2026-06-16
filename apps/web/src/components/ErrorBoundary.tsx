import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

// Catches render-time crashes so the app shows the error instead of a blank
// white page (which is undebuggable).
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('App crashed:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="center"
          style={{ flexDirection: 'column', gap: 14, padding: 24, textAlign: 'center' }}
        >
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Something went wrong</h1>
          <pre
            style={{
              maxWidth: 560,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: 'var(--danger)',
              fontSize: 13,
              margin: 0,
            }}
          >
            {this.state.error.message}
          </pre>
          <button
            className="btn-primary"
            style={{ width: 'auto', marginTop: 0 }}
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
