// src/pages/SettingsPage.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { User, Save, Activity, Key, Trash2, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { Input } from '../components/UI/Input';
import { Button } from '../components/UI/Button';
import { Card, CardHeader, CardContent } from '../components/UI/Card';
import { 
  saveApiKey, 
  checkApiKeyStatus, 
  deleteApiKey 
} from '../../server/services/integrations/healthAI.service';

export function SettingsPage() {
  const { user, updateProfile } = useAuth();
  const toast = useToast();
  
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [loading, setLoading] = useState(false);
  
  // API Key Management
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [lastUsed, setLastUsed] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState(false);
  const [deletingKey, setDeletingKey] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [checkingKey, setCheckingKey] = useState(false);

  useEffect(() => {
    checkGeminiKeyStatus();
  }, []);

  const checkGeminiKeyStatus = async () => {
    setCheckingKey(true);
    try {
      const status = await checkApiKeyStatus('gemini');
      setHasGeminiKey(status.hasKey);
      setLastUsed(status.lastUsed || null);
    } catch (error) {
      console.error('Failed to check API key status:', error);
    } finally {
      setCheckingKey(false);
    }
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    const { error } = await updateProfile({ fullName });
    
    if (error) {
      toast.error(error);
    } else {
      toast.success('Profile updated successfully!');
    }
    
    setLoading(false);
  };

  const handleSaveGeminiKey = async () => {
    if (!geminiApiKey.trim()) {
      toast.error('Please enter an API key');
      return;
    }

    setSavingKey(true);
    try {
      await saveApiKey(geminiApiKey.trim(), 'gemini');
      toast.success('Gemini API key saved successfully!');
      setGeminiApiKey('');
      setShowKey(false);
      await checkGeminiKeyStatus();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save API key');
    } finally {
      setSavingKey(false);
    }
  };

  const handleDeleteGeminiKey = async () => {
    if (!confirm('Are you sure you want to delete your Gemini API key? This will disable AI health insights.')) {
      return;
    }

    setDeletingKey(true);
    try {
      await deleteApiKey('gemini');
      toast.success('Gemini API key deleted successfully');
      setHasGeminiKey(false);
      setLastUsed(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete API key');
    } finally {
      setDeletingKey(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">Manage your account, integrations, and preferences</p>
      </div>

      <div className="space-y-6">
        {/* Profile Information */}
        <Card>
          <CardHeader
            title="Profile Information"
            icon={<User className="w-5 h-5 text-blue-600" />}
          />
          <CardContent>
            <div className="space-y-4">
              <Input
                label="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                fullWidth
              />

              <Input
                label="Email"
                value={user?.email || ''}
                disabled
                helperText="Email cannot be changed"
                fullWidth
              />

              <Button
                onClick={handleSaveProfile}
                loading={loading}
              >
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* API Keys Management */}
        <Card>
          <CardHeader
            title="API Keys"
            icon={<Key className="w-5 h-5 text-purple-600" />}
          />
          <CardContent>
            <div className="space-y-6">
              {/* Gemini API Key */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      Gemini AI API Key
                      {checkingKey ? (
                        <span className="text-xs text-gray-500">Checking...</span>
                      ) : hasGeminiKey ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-gray-400" />
                      )}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Required for AI Health Insights feature
                    </p>
                    {lastUsed && (
                      <p className="text-xs text-gray-500 mt-1">
                        Last used: {new Date(lastUsed).toLocaleString()}
                      </p>
                    )}
                  </div>
                  
                  {hasGeminiKey && (
                    <Button
                      onClick={handleDeleteGeminiKey}
                      loading={deletingKey}
                      variant="destructive"
                      size="sm"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  )}
                </div>

                {hasGeminiKey ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-green-800">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">API key is configured</span>
                    </div>
                    <p className="text-sm text-green-700 mt-2">
                      Your Gemini API key is active and ready to use for AI health analysis.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-800">
                        Get your free Gemini API key from Google AI Studio to enable AI-powered health insights.
                      </p>
                      <a
                        href="https://makersuite.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-2 text-sm text-blue-600 hover:underline font-medium"
                      >
                        Get API Key →
                      </a>
                    </div>

                    <div className="relative">
                      <Input
                        label="Gemini API Key"
                        type={showKey ? "text" : "password"}
                        value={geminiApiKey}
                        onChange={(e) => setGeminiApiKey(e.target.value)}
                        placeholder="AIzaSy..."
                        fullWidth
                      />
                      <button
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-3 top-9 text-gray-500 hover:text-gray-700"
                        type="button"
                      >
                        {showKey ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    <Button
                      onClick={handleSaveGeminiKey}
                      loading={savingKey}
                      disabled={!geminiApiKey.trim()}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save API Key
                    </Button>
                  </div>
                )}
              </div>

              {/* Info Box */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">About API Keys</h4>
                <ul className="text-sm text-gray-700 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>API keys are encrypted before storage</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>You control your own API keys and usage</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>Keys can be updated or deleted anytime</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>Your data never leaves your control</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Integrations */}
        <Card>
          <CardHeader
            title="Health Integrations"
            icon={<Activity className="w-5 h-5 text-green-600" />}
          />
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <h3 className="font-semibold text-gray-900">Fitbit</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Sync your health and fitness data from Fitbit
                  </p>
                </div>
                <Button
                  onClick={() => {
                    window.location.href = '/health';
                  }}
                  variant="outline"
                  size="sm"
                >
                  Manage
                </Button>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-700">
                  Connect your Fitbit account from the Health Dashboard to start tracking your health metrics.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}