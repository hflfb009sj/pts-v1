'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[PTrust] Uncaught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: '#0A0908', color: '#E8E4DC', padding: 24, textAlign: 'center',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', marginBottom: 20,
            background: 'radial-gradient(circle at 35% 30%,#F5C46C,#B8893E 70%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontFamily:"'Fraunces',serif", fontWeight: 900, fontSize: 26, color: '#151310' }}>π</span>
          </div>
          <h2 style={{ fontFamily:"'Fraunces',serif", fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
            Something went wrong
          </h2>
          <p style={{ color: '#8A8378', fontSize: 13, marginBottom: 24, maxWidth: 280, lineHeight: 1.6 }}>
            An unexpected error occurred. Your funds and data are safe.
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            style={{
              background: 'linear-gradient(135deg,#F5C46C,#B8893E)', color: '#151310',
              fontWeight: 800, fontSize: 13, padding: '14px 28px', borderRadius: 16,
              border: 'none', cursor: 'pointer',
            }}>
            Reload Application
          </button>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <pre style={{
              marginTop: 20, padding: 12, background: '#1C1A17', borderRadius: 8,
              fontSize: 10, color: '#C44536', textAlign: 'left', maxWidth: 320,
              overflow: 'auto', border: '1px solid rgba(196,69,54,.3)',
            }}>
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

// Section-level error boundary (non-fatal)
export function SectionErrorBoundary({ children, name }: { children: React.ReactNode; name: string }) {
  return (
    <ErrorBoundary
      fallback={
        <div style={{
          padding: 24, borderRadius: 16, textAlign: 'center',
          background: 'rgba(196,69,54,.08)', border: '1px solid rgba(196,69,54,.25)',
        }}>
          <p style={{ color: '#C44536', fontSize: 12, fontWeight: 800 }}>
            ⚠️ {name} failed to load
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 12, padding: '8px 16px', borderRadius: 12,
              background: 'rgba(196,69,54,.15)', color: '#C44536',
              border: '1px solid rgba(196,69,54,.3)', fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}>
            Reload
          </button>
        </div>
      }>
      {children}
    </ErrorBoundary>
  );
}
