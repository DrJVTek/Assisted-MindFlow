/**
 * Unit tests for OAuthLoginButton component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OAuthLoginButton } from '../../src/components/OAuthLoginButton';
import { useAuthStore } from '../../src/stores/authStore';

// Mock the auth store
vi.mock('../../src/stores/authStore', () => ({
  useAuthStore: vi.fn(),
}));

const mockUseAuthStore = vi.mocked(useAuthStore);

const defaultState = {
  status: 'not_connected' as const,
  subscriptionTier: null,
  userEmail: null,
  isLoggingIn: false,
  error: null,
  needsReauth: false,
  deviceCode: null,
  login: vi.fn(),
  logout: vi.fn(),
  clearError: vi.fn(),
  fetchStatus: vi.fn(),
  startDeviceCode: vi.fn(),
};

describe('OAuthLoginButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthStore.mockReturnValue(defaultState);
  });

  it('renders sign-in button when not connected', () => {
    render(<OAuthLoginButton />);
    expect(screen.getByText('Sign in with ChatGPT')).toBeDefined();
  });

  it('renders connected state with tier and email', () => {
    mockUseAuthStore.mockReturnValue({
      ...defaultState,
      status: 'connected',
      subscriptionTier: 'plus',
      userEmail: 'user@example.com',
    });

    render(<OAuthLoginButton />);
    expect(screen.getByText('Connected (ChatGPT Plus)')).toBeDefined();
    expect(screen.getByText('user@example.com')).toBeDefined();
    expect(screen.getByText('Sign out')).toBeDefined();
  });

  it('renders expired state with re-auth prompt', () => {
    mockUseAuthStore.mockReturnValue({
      ...defaultState,
      status: 'session_expired',
      needsReauth: true,
    });

    render(<OAuthLoginButton />);
    expect(screen.getByText('Session expired. Sign in again.')).toBeDefined();
    expect(screen.getByText('Sign in with ChatGPT')).toBeDefined();
  });

  it('renders connecting state with spinner text', () => {
    mockUseAuthStore.mockReturnValue({
      ...defaultState,
      status: 'connecting',
      isLoggingIn: true,
    });

    render(<OAuthLoginButton />);
    expect(
      screen.getByText('Connecting to ChatGPT... Complete authentication in your browser.')
    ).toBeDefined();
  });

  it('click triggers login', () => {
    const mockLogin = vi.fn();
    mockUseAuthStore.mockReturnValue({
      ...defaultState,
      login: mockLogin,
    });

    render(<OAuthLoginButton />);
    fireEvent.click(screen.getByText('Sign in with ChatGPT'));
    expect(mockLogin).toHaveBeenCalledOnce();
  });

  it('click sign out triggers logout', () => {
    const mockLogout = vi.fn();
    mockUseAuthStore.mockReturnValue({
      ...defaultState,
      status: 'connected',
      subscriptionTier: 'plus',
      logout: mockLogout,
    });

    render(<OAuthLoginButton />);
    fireEvent.click(screen.getByText('Sign out'));
    expect(mockLogout).toHaveBeenCalledOnce();
  });

  it('shows error message when present', () => {
    mockUseAuthStore.mockReturnValue({
      ...defaultState,
      error: 'Connection timed out',
    });

    render(<OAuthLoginButton />);
    expect(screen.getByText('Connection timed out')).toBeDefined();
  });
});
