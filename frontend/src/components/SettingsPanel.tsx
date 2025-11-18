/**
 * Settings Panel Component
 *
 * UI preferences control panel with:
 * - Dark/Light mode toggle
 * - Grid visibility toggle
 * - Minimap visibility toggle
 */

import React from 'react';
import { X, Moon, Sun, Grid3x3, Map } from 'lucide-react';
import { useCanvasStore } from '../stores/canvasStore';

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { preferences, updatePreferences } = useCanvasStore();

  const toggleTheme = () => {
    updatePreferences({ theme: preferences.theme === 'light' ? 'dark' : 'light' });
  };

  const toggleGrid = () => {
    updatePreferences({ gridVisible: !preferences.gridVisible });
  };

  const toggleMinimap = () => {
    updatePreferences({ minimapVisible: !preferences.minimapVisible });
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '320px',
        height: '100vh',
        backgroundColor: 'var(--panel-bg)',
        boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.1)',
        zIndex: 1001,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid var(--panel-border)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: 'var(--spacing-lg)',
          borderBottom: '1px solid var(--panel-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--node-text)',
          }}
        >
          Settings
        </h2>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            color: 'var(--node-text-secondary)',
          }}
          aria-label="Close settings"
        >
          <X size={20} />
        </button>
      </div>

      {/* Settings List */}
      <div style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-lg)' }}>
        {/* Theme Toggle */}
        <SettingRow
          icon={preferences.theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
          label="Theme"
          value={preferences.theme === 'dark' ? 'Dark' : 'Light'}
          onToggle={toggleTheme}
          isActive={preferences.theme === 'dark'}
        />

        {/* Grid Toggle */}
        <SettingRow
          icon={<Grid3x3 size={20} />}
          label="Grid"
          value={preferences.gridVisible ? 'Visible' : 'Hidden'}
          onToggle={toggleGrid}
          isActive={preferences.gridVisible}
        />

        {/* Minimap Toggle */}
        <SettingRow
          icon={<Map size={20} />}
          label="Minimap"
          value={preferences.minimapVisible ? 'Visible' : 'Hidden'}
          onToggle={toggleMinimap}
          isActive={preferences.minimapVisible}
        />
      </div>

      {/* Footer Info */}
      <div
        style={{
          padding: 'var(--spacing-lg)',
          borderTop: '1px solid var(--panel-border)',
          fontSize: '12px',
          color: 'var(--node-text-secondary)',
        }}
      >
        MindFlow Canvas v1.0.0
      </div>
    </div>
  );
}

/**
 * Individual setting row with toggle
 */
interface SettingRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  onToggle: () => void;
  isActive: boolean;
}

function SettingRow({ icon, label, value, onToggle, isActive }: SettingRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--spacing-md)',
        marginBottom: 'var(--spacing-sm)',
        borderRadius: '8px',
        backgroundColor: isActive ? 'rgba(25, 118, 210, 0.08)' : 'transparent',
        transition: 'background-color var(--transition-normal)',
        cursor: 'pointer',
      }}
      onClick={onToggle}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
        <div style={{ color: 'var(--node-text-secondary)', display: 'flex' }}>{icon}</div>
        <div>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--node-text)',
              marginBottom: '2px',
            }}
          >
            {label}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--node-text-secondary)' }}>{value}</div>
        </div>
      </div>

      {/* Toggle Switch */}
      <div
        style={{
          width: '44px',
          height: '24px',
          borderRadius: '12px',
          backgroundColor: isActive ? 'var(--primary-color)' : '#CCCCCC',
          position: 'relative',
          transition: 'background-color var(--transition-normal)',
        }}
      >
        <div
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: 'white',
            position: 'absolute',
            top: '2px',
            left: isActive ? '22px' : '2px',
            transition: 'left var(--transition-normal)',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
          }}
        />
      </div>
    </div>
  );
}
