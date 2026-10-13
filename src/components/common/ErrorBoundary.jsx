import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px 32px',
          textAlign: 'center',
          color: '#64748b',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px'
        }}>
          <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '48px', color: '#f59e0b' }}></i>
          <h2 style={{ color: '#0f172a', fontSize: '20px', fontWeight: 700 }}>Something went wrong</h2>
          <p style={{ fontSize: '14px', maxWidth: '400px' }}>
            {this.state.error?.message || 'An unexpected error occurred while loading this page.'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              border: 'none',
              background: '#6366f1',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <i className="fa-solid fa-rotate-right" style={{ marginRight: '8px' }}></i>
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
