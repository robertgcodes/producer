'use client';

import { useState, useEffect } from 'react';
import { Bundle, ContentItem } from '@/types';
import { toast } from 'sonner';
import { TitleGenerationSettings } from '@/components/dashboard/TitleGenerationSettings';
import { APIKeysSettings } from '@/components/dashboard/APIKeysSettings';
import { useAuth } from '@/contexts/AuthContext';

interface AssetsTabProps {
  bundle: Bundle;
  stories: ContentItem[];
}

interface GeneratedContent {
  claude?: {
    titles: string[];
    tweets: string[];
    instagram: string[];
  };
  chatgpt?: {
    titles: string[];
    tweets: string[];
    instagram: string[];
  };
  grok?: {
    titles: string[];
    tweets: string[];
    instagram: string[];
  };
}

export function AssetsTab({ bundle, stories }: AssetsTabProps) {
  const { user } = useAuth();
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent>({});
  const [isGenerating, setIsGenerating] = useState<Record<string, boolean>>({});
  const [activeContentType, setActiveContentType] = useState<'titles' | 'tweets' | 'instagram'>('titles');
  const [userSettings, setUserSettings] = useState<any>({});
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [currentTitleIndex, setCurrentTitleIndex] = useState<Record<string, number>>({});
  const [expandedTitles, setExpandedTitles] = useState<Record<string, boolean>>({
    claude: true,
    chatgpt: true,
    grok: true
  });

  // Load user settings, API keys, and saved generated content on mount
  useEffect(() => {
    const settings = localStorage.getItem('titleGenerationSettings');
    if (settings) {
      const parsed = JSON.parse(settings);
      console.log('Loaded title generation settings:', parsed);
      setUserSettings(parsed);
    }
    
    // Load API keys from localStorage (in production, these should come from secure backend)
    const storedKeys = {
      claude: localStorage.getItem('claude_api_key') || '',
      gemini: localStorage.getItem('gemini_api_key') || '',
      chatgpt: localStorage.getItem('perplexity_api_key') || '', // Using Perplexity for ChatGPT slot
      grok: localStorage.getItem('gemini_api_key') || '' // Using Gemini for Grok slot
    };
    setApiKeys(storedKeys);

    // Load saved generated content for this bundle
    const savedContentKey = `generatedContent_${bundle.id}`;
    const savedContent = localStorage.getItem(savedContentKey);
    if (savedContent) {
      try {
        const parsed = JSON.parse(savedContent);
        setGeneratedContent(parsed);
      } catch (error) {
        console.error('Error loading saved generated content:', error);
      }
    }
  }, [bundle.id]);

  // Save generated content whenever it changes
  useEffect(() => {
    if (Object.keys(generatedContent).length > 0) {
      const savedContentKey = `generatedContent_${bundle.id}`;
      localStorage.setItem(savedContentKey, JSON.stringify(generatedContent));
    }
  }, [generatedContent, bundle.id]);

  const generateContent = async (aiModel: 'claude' | 'chatgpt' | 'grok', contentType: 'titles' | 'tweets' | 'instagram') => {
    if (stories.length === 0) {
      toast.error('Please add stories to your bundle first. Go to the Stories tab and select stories to include.');
      return;
    }

    const key = `${aiModel}-${contentType}`;
    setIsGenerating(prev => ({ ...prev, [key]: true }));

    try {
      if (contentType === 'titles') {
        // Use the new AI-powered title generation endpoint
        const modelMap: Record<string, string> = {
          claude: 'claude',
          chatgpt: 'chatgpt',
          grok: 'grok'
        };

        // Check for API key (will be checked server-side against env vars too)
        const apiKey = apiKeys[aiModel] || '';

        const requestBody = {
          bundleId: bundle.id,
          bundleTitle: bundle.title,
          bundleDescription: bundle.description,
          stories: stories.map(s => ({ title: s.title, description: s.description })),
          projectId: bundle.projectId,
          model: modelMap[aiModel],
          userSettings,
          apiKey,
          userId: user?.uid
        };

        console.log('Sending to AI:', { model: modelMap[aiModel], userSettings });

        const response = await fetch('/api/generate-ai-titles', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to generate titles');
        }
        
        const data = await response.json();
        setGeneratedContent(prev => ({
          ...prev,
          [aiModel]: {
            ...prev[aiModel],
            titles: data.titles || []
          }
        }));
        
        // Reset title index for this model
        setCurrentTitleIndex(prev => ({ ...prev, [aiModel]: 0 }));
        
        toast.success(`Generated ${data.count} titles with ${aiModel}`);
      } else {
        // Use existing endpoint for tweets and instagram
        const endpoint = '/api/generate-social-content';
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bundleTitle: bundle.title,
            bundleDescription: bundle.description,
            stories: stories.slice(0, 5),
            aiModel,
            contentType
          })
        });

        if (!response.ok) throw new Error('Failed to generate content');
        
        const data = await response.json();
        setGeneratedContent(prev => ({
          ...prev,
          [aiModel]: {
            ...prev[aiModel],
            [contentType]: data[contentType] || data.content || []
          }
        }));
        
        toast.success(`Generated ${contentType} with ${aiModel}`);
      }
    } catch (error) {
      console.error('Error generating content:', error);
      toast.error(error instanceof Error ? error.message : `Failed to generate ${contentType}`);
    } finally {
      setIsGenerating(prev => ({ ...prev, [key]: false }));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const aiModels = [
    { id: 'claude' as const, name: 'Claude', color: 'purple', note: 'Powered by Claude 3.5 Sonnet' },
    { id: 'chatgpt' as const, name: 'Perplexity', color: 'green', note: 'Real-time web search AI' },
    { id: 'grok' as const, name: 'Gemini', color: 'blue', note: 'Google Gemini Pro' }
  ];

  const contentTypes = [
    { id: 'titles' as const, label: 'Titles', icon: '📝' },
    { id: 'tweets' as const, label: 'Tweets', icon: '🐦' },
    { id: 'instagram' as const, label: 'Instagram', icon: '📸' }
  ];

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-950">
      <div className="max-w-6xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Generated Assets</h1>
            <div className="flex items-center gap-3">
              <APIKeysSettings />
              <TitleGenerationSettings />
            </div>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Generate titles, tweets, and social media content using different AI models
          </p>
          {stories.length > 0 ? (
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">
              Based on {stories.length} selected {stories.length === 1 ? 'story' : 'stories'}
            </p>
          ) : (
            <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
              No stories selected - Add stories in the Stories tab first
            </p>
          )}
        </div>

        {/* Content Type Tabs */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm mb-6">
          <div className="border-b border-gray-200 dark:border-gray-800">
            <nav className="flex space-x-1 p-2">
              {contentTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setActiveContentType(type.id)}
                  className={`
                    flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors
                    ${activeContentType === type.id
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }
                  `}
                >
                  <span>{type.icon}</span>
                  {type.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* AI Models Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {aiModels.map((model) => (
            <div key={model.id} className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className={`text-lg font-semibold text-${model.color}-600 dark:text-${model.color}-400`}>
                    {model.name}
                  </h3>
                  {model.note && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{model.note}</p>
                  )}
                </div>
                <button
                  onClick={() => generateContent(model.id, activeContentType)}
                  disabled={isGenerating[`${model.id}-${activeContentType}`] || stories.length === 0}
                  className={`
                    px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-2
                    bg-${model.color}-100 dark:bg-${model.color}-900/30 
                    text-${model.color}-700 dark:text-${model.color}-300
                    hover:bg-${model.color}-200 dark:hover:bg-${model.color}-900/50
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  {isGenerating[`${model.id}-${activeContentType}`] ? (
                    <>
                      <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Generate
                    </>
                  )}
                </button>
              </div>

              {/* Generated Content */}
              <div className="space-y-3">
                {generatedContent[model.id]?.[activeContentType] ? (
                  activeContentType === 'titles' ? (
                    // Special UI for titles with navigation
                    <div className="space-y-4">
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        {/* Current title display */}
                        <div className="mb-3">
                          <p className="text-lg font-medium text-gray-900 dark:text-white leading-snug">
                            {generatedContent[model.id]?.titles?.[currentTitleIndex[model.id] || 0] || ''}
                          </p>
                        </div>
                        
                        {/* Navigation controls */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                const current = currentTitleIndex[model.id] || 0;
                                const titlesLength = generatedContent[model.id]?.titles?.length || 0;
                                const newIndex = current > 0 ? current - 1 : Math.max(0, titlesLength - 1);
                                setCurrentTitleIndex(prev => ({ ...prev, [model.id]: newIndex }));
                              }}
                              className="p-1.5 bg-white dark:bg-gray-700 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                              title="Previous title"
                            >
                              <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                              </svg>
                            </button>
                            
                            <span className="text-sm text-gray-600 dark:text-gray-400 px-2">
                              {(currentTitleIndex[model.id] || 0) + 1} / {generatedContent[model.id]?.titles?.length || 0}
                            </span>
                            
                            <button
                              onClick={() => {
                                const current = currentTitleIndex[model.id] || 0;
                                const titlesLength = generatedContent[model.id]?.titles?.length || 1;
                                const next = (current + 1) % titlesLength;
                                setCurrentTitleIndex(prev => ({ ...prev, [model.id]: next }));
                              }}
                              className="p-1.5 bg-white dark:bg-gray-700 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                              title="Next title"
                            >
                              <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </div>
                          
                          <button
                            onClick={() => copyToClipboard(generatedContent[model.id]?.titles?.[currentTitleIndex[model.id] || 0] || '')}
                            className="p-1.5 bg-white dark:bg-gray-700 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                            title="Copy to clipboard"
                          >
                            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      
                      {/* Show all titles in a scrollable list */}
                      <div className="mt-4">
                        <button
                          onClick={() => setExpandedTitles(prev => ({ ...prev, [model.id]: !prev[model.id] }))}
                          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                        >
                          <svg 
                            className={`w-4 h-4 transition-transform ${expandedTitles[model.id] ? 'rotate-90' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          {expandedTitles[model.id] ? 'Hide' : 'Show'} all {generatedContent[model.id]?.titles?.length || 0} titles
                        </button>
                        {expandedTitles[model.id] && (
                          <div className="mt-2 max-h-48 overflow-y-auto space-y-2 border dark:border-gray-700 rounded-lg p-2">
                            {generatedContent[model.id]?.titles?.map((title: string, idx: number) => (
                              <div
                                key={idx}
                                onClick={() => {
                                  setCurrentTitleIndex(prev => ({ ...prev, [model.id]: idx }));
                                  copyToClipboard(title);
                                }}
                                className={`
                                  p-2 text-sm rounded cursor-pointer transition-colors
                                  ${(currentTitleIndex[model.id] || 0) === idx
                                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                                  }
                                `}
                              >
                                {idx + 1}. {title}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    // Regular display for tweets and instagram
                    generatedContent[model.id][activeContentType].map((item, index) => (
                      <div key={index} className="group relative p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <p className="text-sm text-gray-700 dark:text-gray-300 pr-8">
                          {item}
                        </p>
                        <button
                          onClick={() => copyToClipboard(item)}
                          className="absolute top-2 right-2 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-gray-700 rounded-lg shadow-sm"
                          title="Copy to clipboard"
                        >
                          <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    ))
                  )
                ) : (
                  <div className="text-center py-8">
                    <div className={`w-12 h-12 bg-${model.color}-100 dark:bg-${model.color}-900/30 rounded-lg flex items-center justify-center mx-auto mb-3`}>
                      <svg className={`w-6 h-6 text-${model.color}-600 dark:text-${model.color}-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No {activeContentType} generated yet
                    </p>
                    <button
                      onClick={() => generateContent(model.id, activeContentType)}
                      disabled={stories.length === 0}
                      className={`mt-2 text-sm text-${model.color}-600 hover:text-${model.color}-700 dark:text-${model.color}-400 dark:hover:text-${model.color}-300`}
                    >
                      Generate with {model.name}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Tips Section */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
            💡 Pro Tips
          </h3>
          <ul className="space-y-2 text-sm text-blue-700 dark:text-blue-300">
            <li>• Each AI model has different strengths - try all three for variety</li>
            <li>• Click any generated content to copy it to your clipboard</li>
            <li>• Use the settings button to customize generation parameters</li>
            <li>• Generated content is based on the first 5 stories in your bundle</li>
          </ul>
        </div>
      </div>
    </div>
  );
}