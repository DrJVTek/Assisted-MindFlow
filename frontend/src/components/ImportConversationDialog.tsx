/**
 * ImportConversationDialog Component
 *
 * Lets users browse their ChatGPT conversations and import one
 * as a group of interconnected nodes in the current canvas.
 *
 * Flow: Check token → (setup if needed) → browse (projects + conversations) → preview → import
 *
 * Token setup uses a two-step approach:
 * 1. User copies a one-liner to chatgpt.com console → token shown in prompt()
 * 2. User pastes token into MindFlow input field → MindFlow sends it to backend
 * This avoids CSP issues (chatgpt.com blocks fetch to localhost).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, Download, MessageSquare, ChevronRight, Loader2, GitBranch, ArrowLeft, User, Bot, Copy, AlertCircle, ClipboardPaste, Check, Archive, FolderOpen } from 'lucide-react';
import { api } from '../services/api';

type BrowseTab = 'projects' | 'conversations' | 'archived';

interface ProjectSummary {
  id: string;
  name: string;
  created_at: string | null;
  conversation_count: number | null;
}

interface ConversationSummary {
  id: string;
  title: string;
  created_at: string | null;
  source: string;
}

interface PreviewMessage {
  role: string;
  content_preview: string;
  has_branches: boolean;
}

interface ImportConversationDialogProps {
  graphId: string;
  onClose: () => void;
  onImported: (groupId: string, nodeCount: number) => void;
}

type View = 'checking' | 'setup' | 'browse' | 'project-conversations' | 'preview';

// Console command: extracts ChatGPT session token → shows it in a prompt() dialog.
const CONSOLE_COMMAND = `if(!location.hostname.includes('chatgpt.com')){console.error('%c ERREUR: Execute cette commande sur chatgpt.com ! ','background:#f44336;color:white;padding:4px 12px;border-radius:4px;font-size:14px')}else{fetch('/api/auth/session').then(r=>r.json()).then(d=>{if(!d.accessToken){console.error('%c ERREUR: Pas de token. Es-tu connecte a ChatGPT ? ','background:#f44336;color:white;padding:4px 12px;border-radius:4px;font-size:14px');return}prompt('Token ChatGPT — Ctrl+C pour copier, puis colle dans MindFlow :',d.accessToken)}).catch(()=>console.error('%c ERREUR: Impossible de recuperer la session ','background:#f44336;color:white;padding:4px 12px;border-radius:4px;font-size:14px'))}`;

export function ImportConversationDialog({ graphId, onClose, onImported }: ImportConversationDialogProps) {
  const [view, setView] = useState<View>('checking');
  const [browseTab, setBrowseTab] = useState<BrowseTab>('projects');
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Project drill-down state
  const [selectedProject, setSelectedProject] = useState<ProjectSummary | null>(null);

  // Setup state
  const [commandCopied, setCommandCopied] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [submittingToken, setSubmittingToken] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<string | null>(null);

  // Preview state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTitle, setSelectedTitle] = useState('');
  const [previewMessages, setPreviewMessages] = useState<PreviewMessage[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Import state
  const [importMode, setImportMode] = useState<'active_branch' | 'full_tree'>('active_branch');
  const [importing, setImporting] = useState(false);

  const limit = 20;

  // Check token on mount
  useEffect(() => {
    (async () => {
      try {
        const status = await api.getChatGPTTokenStatus();
        if (status.status === 'connected') {
          setView('browse');
          loadProjects();
        } else {
          setView('setup');
        }
      } catch {
        setView('setup');
      }
    })();
  }, []);

  // Load projects
  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listChatGPTProjects();
      setProjects(data);
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || '';
      if (detail.includes('expired') || detail.includes('invalid') || detail.includes('rejected')) {
        setView('setup');
        setError('Token expire. Reconnecte-toi.');
      } else {
        setError(detail || 'Impossible de charger les projets');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Load conversations (all or archived)
  const loadConversations = useCallback(async (newOffset: number, tab?: BrowseTab) => {
    const currentTab = tab ?? browseTab;
    setLoading(true);
    setError(null);
    try {
      const isArchived = currentTab === 'archived' ? true : undefined;
      const data = await api.listChatGPTConversations(newOffset, limit, isArchived);
      setConversations(data.conversations);
      setTotal(data.total);
      setOffset(newOffset);
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || '';
      if (detail.includes('expired') || detail.includes('invalid') || detail.includes('rejected')) {
        setView('setup');
        setError('Token expire. Reconnecte-toi.');
      } else {
        setError(detail || 'Impossible de charger les conversations');
      }
    } finally {
      setLoading(false);
    }
  }, [browseTab]);

  // Load conversations for a specific project
  const loadProjectConversations = useCallback(async (project: ProjectSummary, newOffset: number) => {
    setSelectedProject(project);
    setView('project-conversations');
    setLoading(true);
    setError(null);
    setOffset(newOffset);
    try {
      const data = await api.listProjectConversations(project.id, newOffset, limit);
      setConversations(data.conversations);
      setTotal(data.total);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Impossible de charger les conversations');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleTabChange = (tab: BrowseTab) => {
    setBrowseTab(tab);
    setOffset(0);
    if (tab === 'projects') {
      loadProjects();
    } else {
      loadConversations(0, tab);
    }
  };

  // Copy the console command to clipboard
  const handleCopyCommand = async () => {
    try {
      await navigator.clipboard.writeText(CONSOLE_COMMAND);
      setCommandCopied(true);
      setTimeout(() => setCommandCopied(false), 4000);
    } catch { /* ignore */ }
  };

  // Paste token from clipboard
  const handlePasteToken = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.length > 20) {
        setTokenInput(text);
      }
    } catch { /* clipboard read may fail, user can type manually */ }
  };

  // Submit the pasted token to the backend
  const handleSubmitToken = async () => {
    const token = tokenInput.trim();
    if (!token) return;

    setSubmittingToken(true);
    setTokenStatus(null);
    setError(null);

    try {
      const result = await api.setChatGPTAccessToken(token);
      if (result.status === 'connected') {
        setTokenStatus('connected');
        setTimeout(() => {
          setView('browse');
          loadProjects();
        }, 800);
      } else {
        setTokenStatus('invalid');
        setError(result.message || 'Token invalide ou expire');
      }
    } catch (err: any) {
      setTokenStatus('invalid');
      setError(err?.response?.data?.detail || err?.message || 'Erreur de connexion au backend');
    } finally {
      setSubmittingToken(false);
    }
  };

  // Preview a conversation
  const handleSelect = async (conv: ConversationSummary) => {
    setSelectedId(conv.id);
    setSelectedTitle(conv.title);
    setView('preview');
    setPreviewLoading(true);
    setError(null);

    try {
      const preview = await api.previewChatGPTConversation(conv.id);
      setPreviewMessages(preview.messages);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Impossible de charger la conversation');
      goBackFromPreview();
    } finally {
      setPreviewLoading(false);
    }
  };

  const goBackFromPreview = () => {
    if (selectedProject) {
      setView('project-conversations');
    } else {
      setView('browse');
    }
  };

  const goBackFromProject = () => {
    setSelectedProject(null);
    setView('browse');
    setBrowseTab('projects');
  };

  // Import
  const handleImport = async () => {
    if (!selectedId) return;
    setImporting(true);
    setError(null);

    try {
      const result = await api.importChatGPTConversation({
        conversation_id: selectedId,
        graph_id: graphId,
        mode: importMode,
      });
      onImported(result.group_id, result.node_count);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Import echoue');
    } finally {
      setImporting(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return ''; }
  };

  const hasMore = offset + limit < total;
  const hasPrev = offset > 0;

  const headerTitle = () => {
    if (view === 'setup') return 'Connexion a ChatGPT';
    if (view === 'preview') return selectedTitle;
    if (view === 'project-conversations' && selectedProject) return selectedProject.name;
    return 'Import ChatGPT';
  };

  const showBackButton = view === 'preview' || view === 'project-conversations';

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          zIndex: 2000, backdropFilter: 'blur(3px)',
        }}
      />

      {/* Dialog */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '560px', maxHeight: '80vh',
        backgroundColor: 'var(--panel-bg)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        border: '1px solid var(--panel-border)',
        zIndex: 2001,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--panel-border)',
          display: 'flex', alignItems: 'center', gap: '12px',
          background: 'var(--panel-bg-secondary)',
        }}>
          {showBackButton && (
            <button onClick={view === 'preview' ? goBackFromPreview : goBackFromProject} style={backBtnStyle}>
              <ArrowLeft size={18} />
            </button>
          )}
          {view === 'project-conversations'
            ? <FolderOpen size={18} style={{ color: '#10a37f' }} />
            : <MessageSquare size={18} style={{ color: '#10a37f' }} />
          }
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--node-text)', flex: 1 }}>
            {headerTitle()}
          </h3>
          <button onClick={onClose} style={backBtnStyle}>
            <X size={18} />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: '10px 20px',
            backgroundColor: 'var(--danger-subtle)', color: 'var(--danger-color)',
            fontSize: '13px', borderBottom: '1px solid var(--panel-border)',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            {error}
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto' }}>

          {/* ── Checking ── */}
          {view === 'checking' && (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--node-text-muted)' }}>
              <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
              <div style={{ fontSize: '13px' }}>Verification de la connexion...</div>
            </div>
          )}

          {/* ── Setup ── */}
          {view === 'setup' && (
            <div style={{ padding: '24px 20px' }}>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <MessageSquare size={32} style={{ color: '#10a37f', marginBottom: '12px' }} />
                <h4 style={{
                  fontSize: '15px', fontWeight: 600,
                  color: 'var(--node-text)', margin: '0 0 8px 0',
                }}>
                  Connexion a l'historique ChatGPT
                </h4>
                <p style={{
                  fontSize: '13px', color: 'var(--node-text-secondary)',
                  lineHeight: 1.6, margin: '0',
                }}>
                  Pour importer tes conversations, MindFlow a besoin d'un <strong>token de session</strong> ChatGPT.
                </p>
              </div>

              {/* Step 1: Copy the command */}
              <div style={{
                padding: '14px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--panel-bg-secondary)',
                border: '1px solid var(--panel-border)',
                marginBottom: '12px',
              }}>
                <div style={{
                  fontSize: '12px', fontWeight: 700,
                  color: 'var(--node-text)', marginBottom: '8px',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                  <span style={stepBadgeStyle}>1</span>
                  Recuperer le token sur chatgpt.com
                </div>
                <div style={{ fontSize: '12px', color: 'var(--node-text-secondary)', lineHeight: 1.6, marginBottom: '10px' }}>
                  Va sur <strong style={{ color: '#10a37f' }}>chatgpt.com</strong>, ouvre la console
                  (<kbd style={kbdStyle}>F12</kbd> → <strong>Console</strong>),
                  colle la commande ci-dessous et appuie sur <kbd style={kbdStyle}>Entree</kbd>.
                </div>
                <button
                  onClick={handleCopyCommand}
                  style={{
                    width: '100%', padding: '10px',
                    fontSize: '13px', fontWeight: 600,
                    borderRadius: 'var(--radius-sm)', border: 'none',
                    backgroundColor: commandCopied ? '#059669' : '#10a37f', color: 'white',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    transition: 'background-color 0.2s',
                  }}
                >
                  {commandCopied ? <Check size={16} /> : <Copy size={16} />}
                  {commandCopied ? 'Commande copiee !' : 'Copier la commande'}
                </button>
              </div>

              {/* Step 2: Paste the token */}
              <div style={{
                padding: '14px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--panel-bg-secondary)',
                border: '1px solid var(--panel-border)',
                marginBottom: '12px',
              }}>
                <div style={{
                  fontSize: '12px', fontWeight: 700,
                  color: 'var(--node-text)', marginBottom: '8px',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                  <span style={stepBadgeStyle}>2</span>
                  Coller le token ici
                </div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="password"
                    value={tokenInput}
                    onChange={e => setTokenInput(e.target.value)}
                    placeholder="Colle ton token ici (Ctrl+V)"
                    style={{
                      flex: 1, padding: '10px 12px',
                      fontSize: '13px', borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${tokenStatus === 'connected' ? '#10a37f' : tokenStatus === 'invalid' ? 'var(--danger-color)' : 'var(--panel-border)'}`,
                      backgroundColor: 'var(--panel-bg)',
                      color: 'var(--node-text)',
                      outline: 'none',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#10a37f'; }}
                    onBlur={e => {
                      if (!tokenStatus) e.currentTarget.style.borderColor = 'var(--panel-border)';
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') handleSubmitToken(); }}
                  />
                  <button
                    onClick={handlePasteToken}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--panel-border)',
                      backgroundColor: 'var(--panel-bg)',
                      color: 'var(--node-text-secondary)',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center',
                    }}
                    title="Coller depuis le presse-papier"
                  >
                    <ClipboardPaste size={16} />
                  </button>
                </div>
                <button
                  onClick={handleSubmitToken}
                  disabled={submittingToken || !tokenInput.trim()}
                  style={{
                    width: '100%', padding: '10px',
                    fontSize: '13px', fontWeight: 600,
                    borderRadius: 'var(--radius-sm)', border: 'none',
                    backgroundColor: tokenStatus === 'connected' ? '#059669' : '#10a37f',
                    color: 'white',
                    cursor: submittingToken ? 'wait' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    opacity: (!tokenInput.trim() || submittingToken) ? 0.6 : 1,
                    transition: 'background-color 0.2s, opacity 0.2s',
                  }}
                >
                  {submittingToken ? (
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : tokenStatus === 'connected' ? (
                    <Check size={16} />
                  ) : (
                    <Download size={16} />
                  )}
                  {submittingToken ? 'Connexion...' : tokenStatus === 'connected' ? 'Connecte !' : 'Connecter'}
                </button>
              </div>

              <p style={{
                fontSize: '11px', color: 'var(--node-text-muted)',
                textAlign: 'center', fontStyle: 'italic', margin: 0,
              }}>
                Le token expire apres quelques heures. Il faudra refaire cette etape si la session expire.
              </p>
            </div>
          )}

          {/* ── Browse (Projects / Conversations / Archived) ── */}
          {view === 'browse' && (
            <>
              {/* Tabs */}
              <div style={{
                display: 'flex', gap: '0', borderBottom: '1px solid var(--panel-border)',
                background: 'var(--panel-bg-secondary)',
              }}>
                {([
                  ['projects', 'Projets', <FolderOpen size={13} key="p" />],
                  ['conversations', 'Conversations', <MessageSquare size={13} key="c" />],
                  ['archived', 'Archives', <Archive size={13} key="a" />],
                ] as const).map(([key, label, icon]) => (
                  <button
                    key={key}
                    onClick={() => handleTabChange(key as BrowseTab)}
                    style={{
                      flex: 1, padding: '10px', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', gap: '6px',
                      border: 'none', borderBottom: browseTab === key ? '2px solid #10a37f' : '2px solid transparent',
                      backgroundColor: 'transparent',
                      color: browseTab === key ? '#10a37f' : 'var(--node-text-muted)',
                      cursor: 'pointer', fontSize: '13px', fontWeight: browseTab === key ? 600 : 400,
                    }}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>

              {loading ? (
                <LoadingSpinner />
              ) : browseTab === 'projects' ? (
                /* Projects list */
                projects.length === 0 ? (
                  <EmptyState text="Aucun projet trouve" />
                ) : (
                  projects.map((project) => (
                    <div
                      key={project.id}
                      onClick={() => loadProjectConversations(project, 0)}
                      style={listItemStyle}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--primary-subtle)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <FolderOpen size={16} style={{ color: '#10a37f', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={listItemTitleStyle}>{project.name}</div>
                        <div style={listItemSubStyle}>
                          {project.conversation_count != null && `${project.conversation_count} conversations`}
                          {project.conversation_count != null && project.created_at && ' · '}
                          {project.created_at && formatDate(project.created_at)}
                        </div>
                      </div>
                      <ChevronRight size={16} style={{ color: 'var(--node-text-muted)', flexShrink: 0 }} />
                    </div>
                  ))
                )
              ) : (
                /* Conversations list */
                <ConversationList
                  conversations={conversations}
                  onSelect={handleSelect}
                  formatDate={formatDate}
                  emptyText={browseTab === 'archived' ? 'Aucune conversation archivee' : 'Aucune conversation trouvee'}
                />
              )}
            </>
          )}

          {/* ── Project Conversations ── */}
          {view === 'project-conversations' && (
            loading ? (
              <LoadingSpinner />
            ) : (
              <ConversationList
                conversations={conversations}
                onSelect={handleSelect}
                formatDate={formatDate}
                emptyText="Aucune conversation dans ce projet"
              />
            )
          )}

          {/* ── Preview ── */}
          {view === 'preview' && (
            <>
              {previewLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--node-text-muted)' }}>
                  <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
                  <div style={{ fontSize: '13px' }}>Chargement de la conversation...</div>
                </div>
              ) : (
                <div style={{ padding: '12px 20px' }}>
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: '8px',
                    maxHeight: '350px', overflow: 'auto', marginBottom: '16px',
                  }}>
                    {previewMessages.map((msg, i) => (
                      <div key={i} style={{
                        display: 'flex', gap: '10px', padding: '10px 12px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: msg.role === 'user' ? 'var(--primary-subtle)' : 'var(--panel-bg-secondary)',
                      }}>
                        <div style={{ flexShrink: 0, marginTop: '2px' }}>
                          {msg.role === 'user'
                            ? <User size={14} style={{ color: 'var(--primary-color)' }} />
                            : <Bot size={14} style={{ color: '#10a37f' }} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', color: 'var(--node-text)', lineHeight: 1.5, wordBreak: 'break-word' }}>
                            {msg.content_preview}
                          </div>
                          {msg.has_branches && (
                            <div style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              marginTop: '4px', fontSize: '11px', color: 'var(--warning-color)',
                            }}>
                              <GitBranch size={11} /> Branches
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{
                      fontSize: '12px', fontWeight: 600, color: 'var(--node-text-secondary)',
                      textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px',
                    }}>Mode d'import</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <ModeButton active={importMode === 'active_branch'} onClick={() => setImportMode('active_branch')}
                        label="Branche active" description="Conversation lineaire" />
                      <ModeButton active={importMode === 'full_tree'} onClick={() => setImportMode('full_tree')}
                        label="Arbre complet" description="Toutes les branches" />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {(view === 'browse' && browseTab !== 'projects' || view === 'project-conversations' || view === 'preview') && (
          <div style={{
            padding: '12px 20px', borderTop: '1px solid var(--panel-border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'var(--panel-bg-secondary)',
          }}>
            {view === 'preview' ? (
              <>
                <span style={{ fontSize: '12px', color: 'var(--node-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <SourceBadge source="chatgpt" />
                  {previewMessages.length} messages
                </span>
                <button
                  onClick={handleImport}
                  disabled={importing || previewLoading}
                  style={{
                    padding: '8px 20px', fontSize: '13px', fontWeight: 600,
                    borderRadius: 'var(--radius-sm)', border: 'none',
                    backgroundColor: '#10a37f', color: 'white',
                    cursor: importing ? 'wait' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px',
                    opacity: importing ? 0.7 : 1,
                  }}
                >
                  {importing
                    ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    : <Download size={14} />}
                  {importing ? 'Import en cours...' : 'Importer'}
                </button>
              </>
            ) : (
              <>
                <span style={{ fontSize: '12px', color: 'var(--node-text-muted)' }}>
                  {total > 0 ? `${offset + 1}\u2013${Math.min(offset + limit, total)} sur ${total}` : ''}
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {hasPrev && (
                    <button
                      onClick={() => {
                        const newOffset = Math.max(0, offset - limit);
                        if (view === 'project-conversations' && selectedProject) {
                          loadProjectConversations(selectedProject, newOffset);
                        } else {
                          loadConversations(newOffset);
                        }
                      }}
                      style={paginationBtnStyle}
                    >
                      Precedent
                    </button>
                  )}
                  {hasMore && (
                    <button
                      onClick={() => {
                        const newOffset = offset + limit;
                        if (view === 'project-conversations' && selectedProject) {
                          loadProjectConversations(selectedProject, newOffset);
                        } else {
                          loadConversations(newOffset);
                        }
                      }}
                      style={paginationBtnStyle}
                    >
                      Suivant
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/* ── Styles & Sub-components ──────────────────── */

const backBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none',
  color: 'var(--node-text-muted)', cursor: 'pointer',
  padding: '4px', display: 'flex', borderRadius: 'var(--radius-sm)',
};

const stepBadgeStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: '20px', height: '20px', borderRadius: '50%',
  backgroundColor: '#10a37f', color: 'white', fontSize: '11px', fontWeight: 700,
};

const kbdStyle: React.CSSProperties = {
  display: 'inline-block', padding: '1px 6px',
  fontSize: '11px', fontFamily: 'Consolas, Monaco, monospace',
  backgroundColor: 'var(--panel-bg)', border: '1px solid var(--panel-border)',
  borderRadius: '3px', boxShadow: '0 1px 0 var(--panel-border)',
};

const paginationBtnStyle: React.CSSProperties = {
  padding: '6px 14px', fontSize: '12px', fontWeight: 500,
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--panel-border)',
  backgroundColor: 'var(--panel-bg)', color: 'var(--node-text)',
  cursor: 'pointer',
};

const listItemStyle: React.CSSProperties = {
  padding: '12px 20px', display: 'flex', alignItems: 'center',
  gap: '12px', cursor: 'pointer',
  borderBottom: '1px solid var(--panel-border)',
  transition: 'background var(--transition-fast)',
};

const listItemTitleStyle: React.CSSProperties = {
  fontSize: '14px', fontWeight: 500, color: 'var(--node-text)',
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
};

const listItemSubStyle: React.CSSProperties = {
  fontSize: '12px', color: 'var(--node-text-muted)', marginTop: '2px',
};

function LoadingSpinner() {
  return (
    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--node-text-muted)' }}>
      <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
      <div style={{ fontSize: '13px' }}>Chargement...</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--node-text-muted)', fontSize: '14px' }}>
      {text}
    </div>
  );
}

function ConversationList({ conversations, onSelect, formatDate, emptyText }: {
  conversations: ConversationSummary[];
  onSelect: (conv: ConversationSummary) => void;
  formatDate: (d: string | null) => string;
  emptyText: string;
}) {
  if (conversations.length === 0) return <EmptyState text={emptyText} />;

  return (
    <>
      {conversations.map((conv) => (
        <div
          key={conv.id}
          onClick={() => onSelect(conv)}
          style={listItemStyle}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--primary-subtle)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <MessageSquare size={16} style={{ color: 'var(--node-text-muted)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={listItemTitleStyle}>{conv.title}</div>
              <SourceBadge source={conv.source} />
            </div>
            {conv.created_at && (
              <div style={listItemSubStyle}>{formatDate(conv.created_at)}</div>
            )}
          </div>
          <ChevronRight size={16} style={{ color: 'var(--node-text-muted)', flexShrink: 0 }} />
        </div>
      ))}
    </>
  );
}

const SOURCE_COLORS: Record<string, string> = {
  chatgpt: '#10a37f',
  claude: '#cc785c',
  gemini: '#4285f4',
};

const SOURCE_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
};

function SourceBadge({ source }: { source: string }) {
  const color = SOURCE_COLORS[source] || '#64748b';
  const label = SOURCE_LABELS[source] || source;
  return (
    <span style={{
      fontSize: '10px', fontWeight: 600, padding: '1px 6px',
      borderRadius: '3px', backgroundColor: color + '20', color,
      whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {label}
    </span>
  );
}

function ModeButton({ active, onClick, label, description }: {
  active: boolean; onClick: () => void; label: string; description: string;
}) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '10px 12px',
      borderRadius: 'var(--radius-sm)',
      border: `1px solid ${active ? 'var(--primary-color)' : 'var(--panel-border)'}`,
      backgroundColor: active ? 'var(--primary-subtle)' : 'var(--panel-bg)',
      color: active ? 'var(--primary-color)' : 'var(--node-text)',
      cursor: 'pointer', textAlign: 'left',
    }}>
      <div style={{ fontSize: '13px', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '11px', color: 'var(--node-text-muted)', marginTop: '2px' }}>{description}</div>
    </button>
  );
}
