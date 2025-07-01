'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { UserService } from '@/lib/userService';
import { APIKeyStatus } from '@/types/user';

export default function SettingsPage() {
  const { user, userProfile, updateUserProfile, saveAPIKey, removeAPIKey, featureAccess } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [apiKeys, setApiKeys] = useState({
    anthropic: '',
    openai: '',
    perplexity: '',
    googleAI: '',
  });
  const [showApiKeys, setShowApiKeys] = useState({
    anthropic: false,
    openai: false,
    perplexity: false,
    googleAI: false,
  });
  const [validatingKeys, setValidatingKeys] = useState<Record<string, boolean>>({});
  const [keyStatuses, setKeyStatuses] = useState<Record<string, APIKeyStatus | null>>({});

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || '');
      setPhotoURL(userProfile.photoURL || '');
    }
  }, [userProfile]);

  const handleUpdateProfile = async () => {
    try {
      await updateUserProfile({
        displayName,
        photoURL,
      });
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error('Failed to update profile');
    }
  };

  const handleSaveApiKey = async (provider: 'anthropic' | 'openai' | 'perplexity' | 'googleAI') => {
    const key = apiKeys[provider].trim();
    if (!key) return;

    setValidatingKeys({ ...validatingKeys, [provider]: true });
    
    try {
      // Validate the key
      const status = await UserService.validateAPIKey(provider, key);
      setKeyStatuses({ ...keyStatuses, [provider]: status });
      
      if (status.isValid) {
        await saveAPIKey(provider, key);
        toast.success(`${provider} API key saved successfully`);
        setApiKeys({ ...apiKeys, [provider]: '' });
      } else {
        toast.error(`Invalid ${provider} API key: ${status.error || 'Unknown error'}`);
      }
    } catch (error) {
      toast.error(`Failed to save ${provider} API key`);
    } finally {
      setValidatingKeys({ ...validatingKeys, [provider]: false });
    }
  };

  const handleRemoveApiKey = async (provider: 'anthropic' | 'openai' | 'perplexity' | 'googleAI') => {
    if (!confirm(`Are you sure you want to remove your ${provider} API key?`)) return;
    
    try {
      await removeAPIKey(provider);
      toast.success(`${provider} API key removed`);
      setKeyStatuses({ ...keyStatuses, [provider]: null });
    } catch (error) {
      toast.error(`Failed to remove ${provider} API key`);
    }
  };

  const getProviderInfo = (provider: string) => {
    switch (provider) {
      case 'anthropic':
        return {
          name: 'Anthropic (Claude)',
          description: 'Powers AI research, content analysis, and advanced features',
          docsUrl: 'https://console.anthropic.com/account/keys',
          features: ['AI Research', 'Content Analysis', 'Story Clustering'],
        };
      case 'openai':
        return {
          name: 'OpenAI (GPT-4)',
          description: 'Enables title generation, summaries, and image analysis',
          docsUrl: 'https://platform.openai.com/api-keys',
          features: ['Title Generation', 'Summaries', 'Thumbnail Generation'],
        };
      case 'perplexity':
        return {
          name: 'Perplexity AI',
          description: 'Provides real-time web search and fact-checking',
          docsUrl: 'https://www.perplexity.ai/settings/api',
          features: ['Web Search', 'Fact Checking', 'Real-time Research'],
        };
      case 'googleAI':
        return {
          name: 'Google AI (Gemini)',
          description: 'Offers multimodal understanding and analysis',
          docsUrl: 'https://makersuite.google.com/app/apikey',
          features: ['Multimodal Analysis', 'Content Understanding'],
        };
      default:
        return { name: provider, description: '', docsUrl: '', features: [] };
    }
  };

  if (!user || !userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      {/* User Profile Section */}
      <div className="card p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Profile Information</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={user.email || ''}
              disabled
              className="input-field opacity-50 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your display name"
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Photo URL</label>
            <input
              type="url"
              value={photoURL}
              onChange={(e) => setPhotoURL(e.target.value)}
              placeholder="https://example.com/photo.jpg"
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Role</label>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {userProfile.role === 'admin' ? 'Administrator' : 'Regular User'}
            </p>
          </div>

          <button
            onClick={handleUpdateProfile}
            className="btn-primary"
          >
            Update Profile
          </button>
        </div>
      </div>

      {/* API Keys Section - Only for non-admin users */}
      {userProfile.role !== 'admin' && (
        <div className="card p-6">
          <h2 className="text-xl font-semibold mb-4">API Keys</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Add your API keys to unlock AI-powered features. Your keys are encrypted and stored securely.
          </p>

          <div className="space-y-6">
            {(['anthropic', 'openai', 'perplexity', 'googleAI'] as const).map((provider) => {
              const info = getProviderInfo(provider);
              const hasKey = !!userProfile.apiKeys?.[provider];
              const isEnabled = featureAccess.availableProviders.includes(provider);

              return (
                <div key={provider} className="border rounded-lg p-4 dark:border-gray-700">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-medium">{info.name}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{info.description}</p>
                      {info.features.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {info.features.map((feature) => (
                            <span
                              key={feature}
                              className={`text-xs px-2 py-1 rounded ${
                                isEnabled
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                  : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                              }`}
                            >
                              {feature}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <a
                      href={info.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      Get API Key →
                    </a>
                  </div>

                  {hasKey ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-green-600 dark:text-green-400">✓ API Key configured</span>
                        <button
                          onClick={() => setShowApiKeys({ ...showApiKeys, [provider]: !showApiKeys[provider] })}
                          className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        >
                          {showApiKeys[provider] ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      <button
                        onClick={() => handleRemoveApiKey(provider)}
                        className="text-sm text-red-600 hover:text-red-700 dark:text-red-400"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type={showApiKeys[provider] ? 'text' : 'password'}
                        value={apiKeys[provider]}
                        onChange={(e) => setApiKeys({ ...apiKeys, [provider]: e.target.value })}
                        placeholder={`Enter your ${info.name} API key`}
                        className="input-field flex-1"
                      />
                      <button
                        onClick={() => setShowApiKeys({ ...showApiKeys, [provider]: !showApiKeys[provider] })}
                        className="btn-secondary px-3"
                      >
                        {showApiKeys[provider] ? '👁' : '👁‍🗨'}
                      </button>
                      <button
                        onClick={() => handleSaveApiKey(provider)}
                        disabled={!apiKeys[provider].trim() || validatingKeys[provider]}
                        className="btn-primary disabled:opacity-50"
                      >
                        {validatingKeys[provider] ? 'Validating...' : 'Save'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Admin Notice */}
      {userProfile.role === 'admin' && (
        <div className="card p-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <h2 className="text-xl font-semibold mb-2 text-blue-900 dark:text-blue-100">Admin Account</h2>
          <p className="text-sm text-blue-800 dark:text-blue-200">
            As an administrator, you have access to all AI features without needing to configure API keys.
            All AI services are enabled for your account.
          </p>
        </div>
      )}
    </div>
  );
}