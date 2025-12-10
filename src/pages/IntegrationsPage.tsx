// src/pages/IntegrationsPage.tsx
import { useEffect, useState } from 'react';
import {
  ToggleLeft,
  ToggleRight,
  Trash2,
  Link2,
  Key,
  Loader2,
  Eye,
  EyeOff,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type Integration = {
  id: string;
  type: string;
  name: string;
  isActive: boolean;
  createdAt: string;
};

type ApiKey = {
  id: string;
  service: string;
  isActive: boolean;
  createdAt: string;
};

const API_KEY_INFO: Record<
  string,
  { label: string; docsUrl: string; placeholder: string }
> = {
  openai: {
    label: 'OpenAI',
    docsUrl: 'https://platform.openai.com/api-keys',
    placeholder: 'sk-…',
  },
  anthropic: {
    label: 'Anthropic (Claude)',
    docsUrl: 'https://console.anthropic.com/',
    placeholder: 'sk-ant-…',
  },
  gemini: {
    label: 'Google Gemini',
    docsUrl: 'https://makersuite.google.com/app/apikey',
    placeholder: 'AIza…',
  },
};

export function IntegrationsPage() {
  const [loading, setLoading] = useState(true);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);

  const [addingKeyFor, setAddingKeyFor] = useState<
    'openai' | 'anthropic' | 'gemini' | null
  >(null);
  const [newKey, setNewKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);

  const loadAll = async () => {
    try {
      setLoading(true);

      const headers: HeadersInit = {
        ...getAuthHeaders(),
      };

      const [intRes, keyRes] = await Promise.all([
        fetch(`${API_BASE_URL}/oauth/integrations`, {
          credentials: 'include',
          headers,
        }),
        fetch(`${API_BASE_URL}/user/api-keys`, {
          credentials: 'include',
          headers,
        }),
      ]);

      if (intRes.ok) {
        const data = await intRes.json();
        setIntegrations(data.integrations || []);
      }
      if (keyRes.ok) {
        const data = await keyRes.json();
        setApiKeys(data.apiKeys || []);
      }
    } catch (err) {
      console.error('Failed to load integrations page', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // Check for OAuth callback success/error in URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const error = params.get('error');
    const message = params.get('message');

    if (success) {
      toast.success(`Successfully connected ${success.replace('_connected', '').toUpperCase()}!`);
      // Clean URL
      window.history.replaceState({}, '', '/integrations');
      loadAll();
    } else if (error) {
      toast.error(message || `Connection failed: ${error}`);
      // Clean URL
      window.history.replaceState({}, '', '/integrations');
    }
  }, []);

  // --- OAuth connect/disconnect/toggle ---

  const handleConnectOAuth = async (type: string) => {
    setConnecting(type);
    try {
      // FIXED: Use the /url endpoint with JWT token instead of direct redirect
      const res = await fetch(`${API_BASE_URL}/oauth/${type}/url`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to get OAuth URL' }));
        toast.error(data.error || 'Failed to initiate connection');
        return;
      }

      const data = await res.json();
      
      // Now redirect to the OAuth URL
      window.location.href = data.url;
    } catch (e: any) {
      console.error('OAuth connect error', e);
      toast.error(e.message || 'Failed to initiate connection');
    } finally {
      setConnecting(null);
    }
  };

  const handleToggleIntegration = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/oauth/integrations/${id}/status`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({ isActive: !isActive }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to update integration status');
        return;
      }

      toast.success('Integration status updated');
      await loadAll();
    } catch (e) {
      console.error('Toggle integration error', e);
      toast.error('Failed to update integration status');
    }
  };

  const handleDisconnectIntegration = async (id: string) => {
    if (!confirm('Disconnect this integration?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/oauth/integrations/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to disconnect integration');
        return;
      }

      toast.success('Integration disconnected');
      await loadAll();
    } catch (e) {
      console.error('Delete integration error', e);
      toast.error('Failed to disconnect integration');
    }
  };

  // --- API key management ---

  const startAddKey = (service: 'openai' | 'anthropic' | 'gemini') => {
    setAddingKeyFor(service);
    setNewKey('');
    setShowKey(false);
  };

  const handleSaveKey = async () => {
    if (!addingKeyFor || !newKey.trim()) return;

    setSavingKey(true);
    try {
      const res = await fetch(`${API_BASE_URL}/user/api-keys`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          service: addingKeyFor,
          apiKey: newKey.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to save API key');
        return;
      }
      toast.success('API key saved successfully!');

      setAddingKeyFor(null);
      setNewKey('');
      await loadAll();
    } catch (e) {
      console.error('Save API key error', e);
      toast.error('Failed to save API key');
    } finally {
      setSavingKey(false);
    }
  };

  const handleToggleKey = async (key: ApiKey) => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/user/api-keys/${key.id}/toggle`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to update API key');
        return;
      }

      toast.success('API key status updated');
      await loadAll();
    } catch (e) {
      console.error('Toggle key error', e);
      toast.error('Failed to update API key');
    }
  };

  const handleDeleteKey = async (key: ApiKey) => {
    if (!confirm('Delete this API key?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/user/api-keys/${key.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to delete API key');
        return;
      }
      toast.success('API key deleted successfully!');

      await loadAll();
    } catch (e) {
      console.error('Delete key error', e);
      toast.error('Failed to delete API key');
    }
  };

  // --- render ---

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Integrations</h1>
          <p className="text-gray-600 text-sm">
            Connect and manage your Google, Slack, Notion and AI providers.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
          <span className="text-gray-500 text-sm">Loading…</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* OAuth integrations */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <Link2 className="w-4 h-4 text-blue-500" />
              Connected apps
            </h2>

            <div className="space-y-3 text-sm">
              {['google', 'slack', 'notion', 'spotify', 'github', 'meta'].map(
                (type) => {
                  const items = integrations.filter((i) => i.type === type);
                  const first = items[0];
                  const isActive = items.some((i) => i.isActive);

                  const labelMap: Record<string, string> = {
                    google: 'Google Workspace',
                    slack: 'Slack',
                    notion: 'Notion',
                    spotify: 'Spotify',
                    github: 'GitHub',
                    meta: 'Meta (FB / IG)',
                  };
                  const label = labelMap[type] || type;

                  return (
                    <div
                      key={type}
                      className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2"
                    >
                      <div>
                        <div className="font-medium text-gray-800">
                          {label}
                        </div>
                        <div className="text-xs text-gray-500">
                          {first
                            ? first.name
                            : 'Not connected. Click connect to authorize.'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {first && (
                          <button
                            onClick={() =>
                              handleToggleIntegration(first.id, isActive)
                            }
                            className="text-gray-500 hover:text-gray-800"
                            title={isActive ? 'Disable' : 'Enable'}
                          >
                            {isActive ? (
                              <ToggleRight className="w-5 h-5 text-emerald-500" />
                            ) : (
                              <ToggleLeft className="w-5 h-5" />
                            )}
                          </button>
                        )}
                        {first && (
                          <button
                            onClick={() =>
                              handleDisconnectIntegration(first.id)
                            }
                            className="text-gray-400 hover:text-red-500"
                            title="Disconnect"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        {!first && (
                          <button
                            onClick={() => handleConnectOAuth(type)}
                            disabled={connecting === type}
                            className="px-3 py-1.5 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 inline-flex items-center gap-2"
                          >
                            {connecting === type && (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            )}
                            Connect
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>

          {/* API keys */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <Key className="w-4 h-4 text-amber-500" />
              AI API Keys
            </h2>

            <div className="space-y-3 text-sm">
              {(['openai', 'anthropic', 'gemini'] as const).map((service) => {
                const keysForService = apiKeys.filter(
                  (k) => k.service === service
                );
                const active = keysForService.find((k) => k.isActive);
                const info = API_KEY_INFO[service];

                return (
                  <div
                    key={service}
                    className="border border-gray-100 rounded-lg px-3 py-2 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium text-gray-800">
                        {info.label}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        {active
                          ? 'Active key configured'
                          : 'No active key. Add one to use AI nodes.'}
                        <a
                          href={info.docsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          Docs
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {active && (
                        <>
                          <button
                            onClick={() => handleToggleKey(active)}
                            className="text-gray-500 hover:text-gray-800"
                          >
                            {active.isActive ? (
                              <ToggleRight className="w-5 h-5 text-emerald-500" />
                            ) : (
                              <ToggleLeft className="w-5 h-5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDeleteKey(active)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => startAddKey(service)}
                        className="px-3 py-1.5 rounded-md text-xs font-medium border border-gray-200 hover:bg-gray-50"
                      >
                        {active ? 'Replace key' : 'Add key'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add key modal (simple inline card) */}
            {addingKeyFor && (
              <div className="mt-4 border border-blue-100 rounded-lg p-4 bg-blue-50/50">
                <div className="text-sm font-medium mb-2">
                  Add {API_KEY_INFO[addingKeyFor].label} API key
                </div>
                <div className="relative mb-3">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder={API_KEY_INFO[addingKeyFor].placeholder}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-sm font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                  >
                    {showKey ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setAddingKeyFor(null)}
                    className="px-3 py-1.5 rounded-md text-xs border border-gray-200 text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveKey}
                    disabled={savingKey || !newKey.trim()}
                    className="px-3 py-1.5 rounded-md text-xs bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-60 inline-flex items-center gap-2"
                  >
                    {savingKey && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                    Save key
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}