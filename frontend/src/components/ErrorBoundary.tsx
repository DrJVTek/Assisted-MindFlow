/**
 * Error Boundary Component
 *
 * Catches React errors and displays a fallback UI
 * Prevents the entire app from crashing due to component errors
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error Boundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            width: '100%',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px',
            backgroundColor: '#F5F5F5',
          }}
        >
          <div
            style={{
              maxWidth: '600px',
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '32px',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h1
              style={{
                fontSize: '24px',
                fontWeight: 600,
                color: '#D32F2F',
                marginBottom: '16px',
                marginTop: 0,
              }}
            >
              Something went wrong
            </h1>

            <p style={{ color: '#546E7A', fontSize: '14px', lineHeight: '1.6' }}>
              The application encountered an unexpected error. Please try refreshing the page or
              contact support if the problem persists.
            </p>

            {this.state.error && (
              <details
                style={{
                  marginTop: '16px',
                  padding: '12px',
                  backgroundColor: '#F5F5F5',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  color: '#37474F',
                }}
              >
                <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: '8px' }}>
                  Error Details
                </summary>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo && '\n\n' + this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
              <button
                onClick={this.handleReset}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#1976D2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#F5F5F5',
                  color: '#546E7A',
                  border: '1px solid #E0E0E0',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
