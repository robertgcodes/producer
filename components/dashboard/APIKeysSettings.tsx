'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, KeyIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';

interface APIKeysSettingsProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function APIKeysSettings({ isOpen = false, onClose }: APIKeysSettingsProps) {
  const [showModal, setShowModal] = useState(isOpen);
  const [apiKeys, setApiKeys] = useState({
    claude: '',
    perplexity: '',
    gemini: '',
    openai: ''
  });
  const [showKeys, setShowKeys] = useState({
    claude: false,
    perplexity: false,
    gemini: false,
    openai: false
  });

  useEffect(() => {
    // Load API keys from localStorage
    setApiKeys({
      claude: localStorage.getItem('claude_api_key') || '',
      perplexity: localStorage.getItem('perplexity_api_key') || '',
      gemini: localStorage.getItem('gemini_api_key') || '',
      openai: localStorage.getItem('openai_api_key') || ''
    });
  }, []);

  const handleSave = () => {
    // Save API keys to localStorage
    Object.entries(apiKeys).forEach(([provider, key]) => {
      if (key) {
        localStorage.setItem(`${provider}_api_key`, key);
      } else {
        localStorage.removeItem(`${provider}_api_key`);
      }
    });
    
    toast.success('API keys saved successfully');
    handleClose();
  };

  const handleClose = () => {
    setShowModal(false);
    onClose?.();
  };

  const toggleShowKey = (provider: keyof typeof showKeys) => {
    setShowKeys(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  const providers = [
    {
      id: 'claude' as const,
      name: 'Claude',
      description: 'Anthropic\'s Claude API for advanced AI generation',
      getKeyUrl: 'https://console.anthropic.com/api-keys',
      color: 'purple',
      envKey: 'CLAUDE_API_KEY'
    },
    {
      id: 'perplexity' as const,
      name: 'Perplexity',
      description: 'Real-time web search AI for current information',
      getKeyUrl: 'https://www.perplexity.ai/settings/api',
      color: 'green',
      envKey: 'PERPLEXITY_API_KEY'
    },
    {
      id: 'gemini' as const,
      name: 'Google Gemini',
      description: 'Google\'s Gemini Pro for AI content generation',
      getKeyUrl: 'https://makersuite.google.com/app/apikey',
      color: 'blue'
    },
    {
      id: 'openai' as const,
      name: 'OpenAI (ChatGPT)',
      description: 'OpenAI\'s GPT models - Coming Soon',
      getKeyUrl: 'https://platform.openai.com/api-keys',
      color: 'orange',
      disabled: true
    }
  ];

  if (!showModal) {
    return (
      <button
        onClick={() => setShowModal(true)}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
      >
        <KeyIcon className="w-4 h-4" />
        API Keys
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75" onClick={handleClose} />

        <div className="inline-block w-full max-w-2xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-gray-800 shadow-xl rounded-2xl">
          {/* Header */}
          <div className="px-6 py-4 border-b dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">API Keys Configuration</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Add your API keys to enable AI-powered content generation
                </p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4 space-y-6 max-h-[60vh] overflow-y-auto">
            {providers.map((provider) => (
              <div key={provider.id} className={`${provider.disabled ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className={`font-medium text-${provider.color}-600 dark:text-${provider.color}-400`}>
                      {provider.name}
                      {provider.envKey && (
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                          (or use env: {provider.envKey})
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{provider.description}</p>
                  </div>
                  {!provider.disabled && (
                    <a
                      href={provider.getKeyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      Get API Key →
                    </a>
                  )}
                </div>
                
                <div className="relative">
                  <input
                    type={showKeys[provider.id] ? 'text' : 'password'}
                    value={apiKeys[provider.id]}
                    onChange={(e) => setApiKeys(prev => ({ ...prev, [provider.id]: e.target.value }))}
                    disabled={provider.disabled}
                    placeholder={provider.disabled ? 'Coming soon...' : `Enter your ${provider.name} API key`}
                    className="w-full px-3 py-2 pr-10 border rounded-lg bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                  />
                  {!provider.disabled && apiKeys[provider.id] && (
                    <button
                      type="button"
                      onClick={() => toggleShowKey(provider.id)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3"
                    >
                      {showKeys[provider.id] ? (
                        <EyeSlashIcon className="w-5 h-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                      ) : (
                        <EyeIcon className="w-5 h-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}

            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Security Note:</strong> API keys are stored locally in your browser. Never share your API keys publicly.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t dark:border-gray-700 flex justify-end gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              Save API Keys
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}