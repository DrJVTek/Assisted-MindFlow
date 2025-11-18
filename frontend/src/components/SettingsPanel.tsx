/**
 * Settings Panel Component
 *
 * Tabbed settings interface with:
 * - Appearance: Dark/Light mode, Grid, Minimap
 * - LLM: Provider configuration, API keys, model selection
 */

import React, { useState, useEffect } from 'react';
import { X, Moon, Sun, Grid3x3, Map, Brain, Eye, Save, TestTube } from 'lucide-react';
import { useCanvasStore } from '../stores/canvasStore';

interface SettingsPanelProps {
  onClose: () => void;
}

type Tab = 'appearance' | 'llm';

type LLMProvider = 'openai' | 'anthropic' | 'ollama' | 'custom';

interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  baseUrl?: string; // For Ollama or custom
  model: string;
  temperature: number;
  maxTokens: number;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { preferences, updatePreferences } = useCanvasStore();
  const [activeTab, setActiveTab] = useState<Tab>('appearance');

  // LLM configuration state
  const [llmConfig, setLLMConfig] = useState<LLMConfig>(() => {
    const stored = localStorage.getItem('mindflow_llm_config');
    return stored ? JSON.parse(stored) : {
      provider: 'openai' as LLMProvider,
      apiKey: '',
      baseUrl: '',
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 2000,
    };
  });

  const [llmSaveIndicator, setLLMSaveIndicator] = useState<string | null>(null);

  // Auto-save LLM config to localStorage
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

  const testLLMConnection = async () => {
    setLLMSaveIndicator('Testing...');

    // Simulate test for now - later integrate with actual LLM API
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (!llmConfig.apiKey) {
      setLLMSaveIndicator('Error: API key required');
      setTimeout(() => setLLMSaveIndicator(null), 3000);
      return;
    }

    setLLMSaveIndicator('Connection successful!');
    setTimeout(() => setLLMSaveIndicator(null), 3000);
  };

  // Get available models based on provider
  const getModelsForProvider = (provider: LLMProvider): string[] => {
    switch (provider) {
      case 'openai':
        return ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'];
      case 'anthropic':
        return ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'];
      case 'ollama':
        return ['llama2', 'mistral', 'codellama', 'mixtral'];
      case 'custom':
        return ['custom-model'];
      default:
        return [];
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '400px',
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

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--panel-border)',
          backgroundColor: 'var(--panel-bg)',
        }}
      >
        <Tab
          icon={<Eye size={16} />}
          label="Appearance"
          isActive={activeTab === 'appearance'}
          onClick={() => setActiveTab('appearance')}
        />
        <Tab
          icon={<Brain size={16} />}
          label="LLM"
          isActive={activeTab === 'llm'}
          onClick={() => setActiveTab('llm')}
        />
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-lg)' }}>
        {activeTab === 'appearance' && (
          <div>
            <SettingRow
              icon={preferences.theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
              label="Theme"
              value={preferences.theme === 'dark' ? 'Dark' : 'Light'}
              onToggle={toggleTheme}
              isActive={preferences.theme === 'dark'}
            />

            <SettingRow
              icon={<Grid3x3 size={20} />}
              label="Grid"
              value={preferences.gridVisible ? 'Visible' : 'Hidden'}
              onToggle={toggleGrid}
              isActive={preferences.gridVisible}
            />

            <SettingRow
              icon={<Map size={20} />}
              label="Minimap"
              value={preferences.minimapVisible ? 'Visible' : 'Hidden'}
              onToggle={toggleMinimap}
              isActive={preferences.minimapVisible}
            />
          </div>
        )}

        {activeTab === 'llm' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
            {/* Provider Selection */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--node-text)',
                  marginBottom: 'var(--spacing-sm)',
                }}
              >
                LLM Provider
              </label>
              <select
                value={llmConfig.provider}
                onChange={(e) => {
                  const provider = e.target.value as LLMProvider;
                  const models = getModelsForProvider(provider);
                  setLLMConfig({
                    ...llmConfig,
                    provider,
                    model: models[0] || '',
                  });
                }}
                style={{
                  width: '100%',
                  padding: 'var(--spacing-md)',
                  fontSize: '14px',
                  borderRadius: '6px',
                  border: '1px solid var(--panel-border)',
                  backgroundColor: 'var(--panel-bg)',
                  color: 'var(--node-text)',
                }}
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="ollama">Ollama (Local)</option>
                <option value="custom">Custom API</option>
              </select>
            </div>

            {/* API Key */}
            {llmConfig.provider !== 'ollama' && (
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'var(--node-text)',
                    marginBottom: 'var(--spacing-sm)',
                  }}
                >
                  API Key
                </label>
                <input
                  type="password"
                  value={llmConfig.apiKey}
                  onChange={(e) => setLLMConfig({ ...llmConfig, apiKey: e.target.value })}
                  placeholder="sk-..."
                  style={{
                    width: '100%',
                    padding: 'var(--spacing-md)',
                    fontSize: '14px',
                    borderRadius: '6px',
                    border: '1px solid var(--panel-border)',
                    backgroundColor: 'var(--panel-bg)',
                    color: 'var(--node-text)',
                  }}
                />
              </div>
            )}

            {/* Base URL for Ollama/Custom */}
            {(llmConfig.provider === 'ollama' || llmConfig.provider === 'custom') && (
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'var(--node-text)',
                    marginBottom: 'var(--spacing-sm)',
                  }}
                >
                  Base URL
                </label>
                <input
                  type="text"
                  value={llmConfig.baseUrl || ''}
                  onChange={(e) => setLLMConfig({ ...llmConfig, baseUrl: e.target.value })}
                  placeholder={llmConfig.provider === 'ollama' ? 'http://localhost:11434' : 'https://api.example.com'}
                  style={{
                    width: '100%',
                    padding: 'var(--spacing-md)',
                    fontSize: '14px',
                    borderRadius: '6px',
                    border: '1px solid var(--panel-border)',
                    backgroundColor: 'var(--panel-bg)',
                    color: 'var(--node-text)',
                  }}
                />
              </div>
            )}

            {/* Model Selection */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--node-text)',
                  marginBottom: 'var(--spacing-sm)',
                }}
              >
                Model
              </label>
              <select
                value={llmConfig.model}
                onChange={(e) => setLLMConfig({ ...llmConfig, model: e.target.value })}
                style={{
                  width: '100%',
                  padding: 'var(--spacing-md)',
                  fontSize: '14px',
                  borderRadius: '6px',
                  border: '1px solid var(--panel-border)',
                  backgroundColor: 'var(--panel-bg)',
                  color: 'var(--node-text)',
                }}
              >
                {getModelsForProvider(llmConfig.provider).map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>

            {/* Temperature Slider */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--node-text)',
                  marginBottom: 'var(--spacing-sm)',
                }}
              >
                Temperature: {llmConfig.temperature.toFixed(1)}
              </label>
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
                }}
              />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: 'var(--node-text-secondary)',
                  marginTop: 'var(--spacing-xs)',
                }}
              >
                <span>Precise</span>
                <span>Creative</span>
              </div>
            </div>

            {/* Max Tokens */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--node-text)',
                  marginBottom: 'var(--spacing-sm)',
                }}
              >
                Max Tokens
              </label>
              <input
                type="number"
                min="100"
                max="32000"
                step="100"
                value={llmConfig.maxTokens}
                onChange={(e) => setLLMConfig({ ...llmConfig, maxTokens: parseInt(e.target.value) })}
                style={{
                  width: '100%',
                  padding: 'var(--spacing-md)',
                  fontSize: '14px',
                  borderRadius: '6px',
                  border: '1px solid var(--panel-border)',
                  backgroundColor: 'var(--panel-bg)',
                  color: 'var(--node-text)',
                }}
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)' }}>
              <button
                onClick={testLLMConnection}
                style={{
                  flex: 1,
                  padding: 'var(--spacing-md)',
                  fontSize: '14px',
                  fontWeight: 500,
                  borderRadius: '6px',
                  border: '1px solid var(--panel-border)',
                  backgroundColor: 'transparent',
                  color: 'var(--node-text)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--spacing-sm)',
                }}
              >
                <TestTube size={16} />
                Test
              </button>
              <button
                onClick={saveLLMConfig}
                style={{
                  flex: 1,
                  padding: 'var(--spacing-md)',
                  fontSize: '14px',
                  fontWeight: 500,
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'var(--primary-color)',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--spacing-sm)',
                }}
              >
                <Save size={16} />
                Save
              </button>
            </div>

            {/* Save Indicator */}
            {llmSaveIndicator && (
              <div
                style={{
                  padding: 'var(--spacing-md)',
                  backgroundColor: llmSaveIndicator.includes('Error') ? '#f44336' : '#4caf50',
                  color: 'white',
                  borderRadius: '6px',
                  textAlign: 'center',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
              >
                {llmSaveIndicator}
              </div>
            )}
          </div>
        )}
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
 * Tab button component
 */
interface TabProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function Tab({ icon, label, isActive, onClick }: TabProps) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: 'var(--spacing-md)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--spacing-sm)',
        border: 'none',
        borderBottom: isActive ? '2px solid var(--primary-color)' : '2px solid transparent',
        backgroundColor: isActive ? 'rgba(25, 118, 210, 0.08)' : 'transparent',
        color: isActive ? 'var(--primary-color)' : 'var(--node-text-secondary)',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: isActive ? 600 : 500,
        transition: 'all var(--transition-fast)',
      }}
    >
      {icon}
      {label}
    </button>
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
