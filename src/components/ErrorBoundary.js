import { Component } from 'react';
import { Link } from 'react-router-dom';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page-body" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: 'calc(100vh - var(--nav-h))', padding: '40px var(--page-pad)',
        }}>
          <div style={{ textAlign: 'center', maxWidth: 420 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'var(--accent-light)', color: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px', fontSize: '1.6rem',
              fontFamily: "'DM Serif Display', serif",
            }}>!</div>
            <h1 style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: '1.8rem', letterSpacing: '-0.025em', marginBottom: '12px',
            }}>Something went wrong</h1>
            <p style={{
              color: 'var(--ink-muted)', fontSize: '0.9rem',
              lineHeight: 1.6, marginBottom: '28px',
            }}>
              An unexpected error occurred. Try refreshing the page or heading back to the home page.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                className="btn-dark"
              >
                <span>Refresh Page</span>
              </button>
              <Link
                to="/"
                className="btn-outline"
                onClick={() => this.setState({ hasError: false, error: null })}
              >
                Go Home
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}