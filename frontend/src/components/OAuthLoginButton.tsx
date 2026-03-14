/**
 * OAuthLoginButton Component
 *
 * Shows different states based on ChatGPT OAuth session:
 * - Not connected: "Sign in with ChatGPT" button
 * - Connecting: Spinner with "Connecting..." text
 * - Connected: Status display with "Sign out" button
 * - Expired: "Session expired — Sign in again" banner
 */

import React, { useEffect, useRef } from 'react';
import { LogIn, LogOut, Loader2, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

export function OAuthLoginButton() {
  const { status, subscriptionTier, userEmail, isLoggingIn, error, needsReauth, deviceCode, login, logout, clearError, fetchStatus, startDeviceCode } =
    useAuthStore();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch session status on mount (restores state after page reload)
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Poll session status every 60s when connected
  useEffect(() => {
    if (status === 'connected') {
      pollRef.current = setInterval(fetchStatus, 60_000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [status, fetchStatus]);

  if (isLoggingIn || status === 'connecting') {
    if (deviceCode) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--node-text-secondary)' }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '13px' }}>Waiting for authorization...</span>
          </div>
          <div style={{
            padding: '12px',
            borderRadius: '8px',
            backgroundColor: 'rgba(25, 118, 210, 0.08)',
            border: '1px solid rgba(25, 118, 210, 0.2)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '12px', color: 'var(--node-text-secondary)', marginBottom: '4px' }}>
              Visit <a href={deviceCode.verificationUri} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)' }}>{deviceCode.verificationUri}</a>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '4px', color: 'var(--node-text)', fontFamily: 'monospace' }}>
              {deviceCode.userCode}
            </div>
          </div>
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', color: 'var(--node-text-secondary)' }}>
        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: '13px' }}>Connecting to ChatGPT... Complete authentication in your browser.</span>
      </div>
    );
  }

  if (status === 'connected') {
    const tierLabel = subscriptionTier ? `ChatGPT ${subscriptionTier.charAt(0).toUpperCase() + subscriptionTier.slice(1)}` : 'ChatGPT';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px',
            borderRadius: '8px',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            border: '1px solid rgba(76, 175, 80, 0.3)',
          }}
        >
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#4caf50' }}>
              Connected ({tierLabel})
            </div>
            {userEmail && (
              <div style={{ fontSize: '12px', color: 'var(--node-text-secondary)', marginTop: '2px' }}>
                {userEmail}
              </div>
            )}
          </div>
          <button
            onClick={logout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 12px',
              fontSize: '12px',
              borderRadius: '6px',
              border: '1px solid var(--panel-border)',
              backgroundColor: 'transparent',
              color: 'var(--node-text-secondary)',
              cursor: 'pointer',
            }}
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (status === 'session_expired' || needsReauth) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px',
            borderRadius: '8px',
            backgroundColor: 'rgba(255, 152, 0, 0.1)',
            border: '1px solid rgba(255, 152, 0, 0.3)',
          }}
        >
          <AlertTriangle size={16} style={{ color: '#ff9800' }} />
          <span style={{ fontSize: '13px', color: '#ff9800', fontWeight: 500 }}>
            Session expired. Sign in again.
          </span>
        </div>
        <button
          onClick={login}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px',
            fontSize: '14px',
            fontWeight: 500,
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#10a37f',
            color: 'white',
            cursor: 'pointer',
          }}
        >
          <LogIn size={16} />
          Sign in with ChatGPT
        </button>
      </div>
    );
  }

  // Not connected or error state
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <button
        onClick={login}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '10px',
          fontSize: '14px',
          fontWeight: 500,
          borderRadius: '8px',
          border: 'none',
          backgroundColor: '#10a37f',
          color: 'white',
          cursor: 'pointer',
        }}
      >
        <LogIn size={16} />
        Sign in with ChatGPT
      </button>
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderRadius: '6px',
            backgroundColor: 'rgba(244, 67, 54, 0.1)',
            border: '1px solid rgba(244, 67, 54, 0.3)',
          }}
        >
          <span style={{ fontSize: '12px', color: '#f44336' }}>{error}</span>
          <button
            onClick={clearError}
            style={{
              background: 'none',
              border: 'none',
              color: '#f44336',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '0 4px',
            }}
          >
            x
          </button>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: 'var(--node-text-secondary)' }}>
          Use your ChatGPT Plus subscription instead of an API key.
        </span>
        <button
          onClick={startDeviceCode}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--primary-color)',
            cursor: 'pointer',
            fontSize: '12px',
            textDecoration: 'underline',
            padding: 0,
          }}
        >
          Use Device Code
        </button>
      </div>
    </div>
  );
}
