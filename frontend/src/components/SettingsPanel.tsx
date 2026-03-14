/**
 * Settings Panel Component
 *
 * Tabbed settings interface with:
 * - Appearance: Dark/Light mode, Grid, Minimap
 * - LLM: Provider configuration, API keys, model selection
 */

import React, { useState, useEffect } from 'react';
import { X, Moon, Sun, Grid3x3, Map, Brain, Eye, Save, Plug } from 'lucide-react';
import { useCanvasStore } from '../stores/canvasStore';
// OAuthLoginButton removed — OAuth is now inline per-provider in ProviderSettingsPanel
import { ProviderSettingsPanel } from './ProviderSettingsPanel';
import { MCPConnectionsPanel } from './MCPConnectionsPanel';

interface SettingsPanelProps {
  onClose: () => void;
}

type Tab = 'appearance' | 'llm_providers' | 'mcp';

interface LLMDefaults {
  temperature: number;
  maxTokens: number;
}

// Shared input style
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: '13px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--panel-border)',
  backgroundColor: 'var(--panel-bg-secondary)',
  color: 'var(--node-text)',
  outline: 'none',
  transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--node-text-secondary)',
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { preferences, updatePreferences } = useCanvasStore();
  const [activeTab, setActiveTab] = useState<Tab>('appearance');

  const [llmConfig, setLLMConfig] = useState<LLMDefaults>(() => {
    const stored = localStorage.getItem('mindflow_llm_config');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return {
          temperature: parsed.temperature ?? 0.7,
          maxTokens: parsed.maxTokens ?? 2000,
        };
      } catch { /* ignore */ }
    }
    return { temperature: 0.7, maxTokens: 2000 };
  });

  const [llmSaveIndicator, setLLMSaveIndicator] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('mindflow_llm_config', JSON.stringify(llmConfig));
  }, [llmConfig]);

  const toggleTheme = () => {
    updatePreferences({ theme: preferences.theme === 'light' ? 'dark' : 'light' });
  };

  const toggleGrid = () => {
    updatePreferences({ gridVisible: !preferences.gridVisible });
  };

  const toggleMinimap = () => {
    updatePreferences({ minimapVisible: !preferences.minimapVisible });
  };

  const saveLLMConfig = () => {
    localStorage.setItem('mindflow_llm_config', JSON.stringify(llmConfig));
    setLLMSaveIndicator('Saved!');
    setTimeout(() => setLLMSaveIndicator(null), 2000);
  };

  const indicatorIsError = llmSaveIndicator?.includes('Error') || llmSaveIndicator?.includes('Warning');

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          zIndex: 1000,
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '420px',
          height: '100vh',
          backgroundColor: 'var(--panel-bg)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid var(--panel-border)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--panel-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--panel-bg-secondary)',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 700,
              color: 'var(--node-text)',
              letterSpacing: '-0.3px',
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
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              color: 'var(--node-text-muted)',
              borderRadius: 'var(--radius-sm)',
              transition: 'all var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--danger-subtle)';
              e.currentTarget.style.color = 'var(--danger-color)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--node-text-muted)';
            }}
            aria-label="Close settings"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--panel-border)',
            padding: '0 24px',
            gap: '4px',
            background: 'var(--panel-bg-secondary)',
          }}
        >
          <TabButton
            icon={<Eye size={15} />}
            label="Appearance"
            isActive={activeTab === 'appearance'}
            onClick={() => setActiveTab('appearance')}
          />
          <TabButton
            icon={<Brain size={15} />}
            label="LLM Providers"
            isActive={activeTab === 'llm_providers'}
            onClick={() => setActiveTab('llm_providers')}
          />
          <TabButton
            icon={<Plug size={15} />}
            label="MCP"
            isActive={activeTab === 'mcp'}
            onClick={() => setActiveTab('mcp')}
          />
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
          {activeTab === 'appearance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <SettingRow
                icon={preferences.theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                label="Theme"
                value={preferences.theme === 'dark' ? 'Dark' : 'Light'}
                onToggle={toggleTheme}
                isActive={preferences.theme === 'dark'}
              />
              <SettingRow
                icon={<Grid3x3 size={18} />}
                label="Grid"
                value={preferences.gridVisible ? 'Visible' : 'Hidden'}
                onToggle={toggleGrid}
                isActive={preferences.gridVisible}
              />
              <SettingRow
                icon={<Map size={18} />}
                label="Minimap"
                value={preferences.minimapVisible ? 'Visible' : 'Hidden'}
                onToggle={toggleMinimap}
                isActive={preferences.minimapVisible}
              />
            </div>
          )}

          {activeTab === 'llm_providers' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Provider Registry — unified CRUD with OAuth inline */}
              <ProviderSettingsPanel />

              {/* Shared LLM Defaults */}
              <div style={{ borderTop: '1px solid var(--panel-border)', paddingTop: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--node-text)', marginBottom: '16px' }}>
                  Generation Defaults
                </h3>

                {/* Temperature */}
                <Section title={`Temperature: ${llmConfig.temperature.toFixed(1)}`}>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={llmConfig.temperature}
                    onChange={(e) => setLLMConfig({ ...llmConfig, temperature: parseFloat(e.target.value) })}
                    style={{
                      width: '100%',
                      accentColor: 'var(--primary-color)',
                      height: '6px',
                      cursor: 'pointer',
                    }}
                  />
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                      color: 'var(--node-text-muted)',
                      marginTop: '4px',
                    }}
                  >
                    <span>Precise</span>
                    <span>Creative</span>
                  </div>
                </Section>

                {/* Max Tokens */}
                <div style={{ marginTop: '16px' }}>
                  <Section title="Max Tokens">
                    <input
                      type="number"
                      min="100"
                      max="32000"
                      step="100"
                      value={llmConfig.maxTokens}
                      onChange={(e) => setLLMConfig({ ...llmConfig, maxTokens: parseInt(e.target.value) })}
                      style={inputStyle}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'var(--primary-color)';
                        e.currentTarget.style.boxShadow = '0 0 0 3px var(--primary-subtle)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'var(--panel-border)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </Section>
                </div>

                {/* Save defaults */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                  <button
                    onClick={saveLLMConfig}
                    style={{
                      flex: 1,
                      padding: '10px',
                      fontSize: '13px',
                      fontWeight: 600,
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      backgroundColor: 'var(--primary-color)',
                      color: 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'filter var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
                  >
                    <Save size={14} />
                    Save Defaults
                  </button>
                </div>

                {/* Status Indicator */}
                {llmSaveIndicator && (
                  <div
                    style={{
                      marginTop: '10px',
                      padding: '10px 14px',
                      backgroundColor: indicatorIsError ? 'var(--danger-subtle)' : 'var(--success-subtle)',
                      color: indicatorIsError ? 'var(--danger-color)' : 'var(--success-color)',
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${indicatorIsError ? 'var(--danger-color)' : 'var(--success-color)'}`,
                      textAlign: 'center',
                      fontSize: '13px',
                      fontWeight: 500,
                      opacity: 0.9,
                    }}
                  >
                    {llmSaveIndicator}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'mcp' && (
            <MCPConnectionsPanel />
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--panel-border)',
            fontSize: '11px',
            color: 'var(--node-text-muted)',
            background: 'var(--panel-bg-secondary)',
          }}
        >
          MindFlow Canvas v1.0.0
        </div>
      </div>
    </>
  );
}

/* ────────────────────────────────────────────── */
/*  Sub-components                                */
/* ────────────────────────────────────────────── */

/** Section with uppercase label and optional trailing element */
function Section({ title, trailing, children }: {
  title: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <label style={labelStyle}>{title}</label>
        {trailing}
      </div>
      {children}
    </div>
  );
}

/** Tab button */
function TabButton({ icon, label, isActive, onClick }: {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        border: 'none',
        borderBottom: isActive ? '2px solid var(--primary-color)' : '2px solid transparent',
        backgroundColor: 'transparent',
        color: isActive ? 'var(--primary-color)' : 'var(--node-text-muted)',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: isActive ? 600 : 500,
        transition: 'all var(--transition-fast)',
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

/** Setting row with toggle switch */
function SettingRow({ icon, label, value, onToggle, isActive }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onToggle: () => void;
  isActive: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 12px',
        borderRadius: 'var(--radius-md)',
        backgroundColor: isActive ? 'var(--primary-subtle)' : 'transparent',
        transition: 'background-color var(--transition-fast)',
        cursor: 'pointer',
      }}
      onClick={onToggle}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.backgroundColor = 'var(--panel-bg-secondary)';
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ color: isActive ? 'var(--primary-color)' : 'var(--node-text-muted)', display: 'flex' }}>
          {icon}
        </div>
        <div>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--node-text)',
              marginBottom: '1px',
            }}
          >
            {label}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--node-text-muted)' }}>{value}</div>
        </div>
      </div>

      {/* Toggle Switch */}
      <div
        style={{
          width: '40px',
          height: '22px',
          borderRadius: '11px',
          backgroundColor: isActive ? 'var(--primary-color)' : 'var(--panel-border)',
          position: 'relative',
          transition: 'background-color var(--transition-normal)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            backgroundColor: 'white',
            position: 'absolute',
            top: '2px',
            left: isActive ? '20px' : '2px',
            transition: 'left var(--transition-normal)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
          }}
        />
      </div>
    </div>
  );
}
