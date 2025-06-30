'use client';

import { useState, useEffect } from 'react';
import { ResearchBlockType } from '@/types';
import { researchBlockTemplates } from '@/lib/research/templates';
import { toast } from 'sonner';

interface ResearchPromptSettings {
  [key: string]: string; // blockType -> custom prompt
}

export function ResearchPromptSettings() {
  const [prompts, setPrompts] = useState<ResearchPromptSettings>({});
  const [editingType, setEditingType] = useState<ResearchBlockType | null>(null);
  const [tempPrompt, setTempPrompt] = useState('');

  // Load saved prompts from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('researchPromptSettings');
    if (saved) {
      setPrompts(JSON.parse(saved));
    }
  }, []);

  const handleSavePrompt = (type: ResearchBlockType) => {
    const updated = { ...prompts, [type]: tempPrompt };
    setPrompts(updated);
    localStorage.setItem('researchPromptSettings', JSON.stringify(updated));
    setEditingType(null);
    setTempPrompt('');
    toast.success('Prompt saved successfully');
  };

  const handleResetPrompt = (type: ResearchBlockType) => {
    const updated = { ...prompts };
    delete updated[type];
    setPrompts(updated);
    localStorage.setItem('researchPromptSettings', JSON.stringify(updated));
    toast.success('Prompt reset to default');
  };

  const handleStartEdit = (type: ResearchBlockType) => {
    const template = researchBlockTemplates.find(t => t.type === type);
    setEditingType(type);
    setTempPrompt(prompts[type] || template?.defaultPrompt || '');
  };

  return (
    <div className="max-w-4xl">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Research Prompt Templates
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Customize the prompts used for each research block type. These will be used as defaults when creating new research blocks.
      </p>

      <div className="space-y-4">
        {researchBlockTemplates.map(template => (
          <div
            key={template.type}
            className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">
                  {template.name}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {template.description}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {prompts[template.type] && (
                  <span className="text-xs bg-brand-100 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 px-2 py-1 rounded">
                    Customized
                  </span>
                )}
                {editingType !== template.type ? (
                  <>
                    <button
                      onClick={() => handleStartEdit(template.type)}
                      className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                    >
                      Edit
                    </button>
                    {prompts[template.type] && (
                      <button
                        onClick={() => handleResetPrompt(template.type)}
                        className="text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                      >
                        Reset
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleSavePrompt(template.type)}
                      className="text-sm text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingType(null);
                        setTempPrompt('');
                      }}
                      className="text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>

            {editingType === template.type && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Research Prompt
                </label>
                <textarea
                  value={tempPrompt}
                  onChange={(e) => setTempPrompt(e.target.value)}
                  className="w-full h-40 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 font-mono text-sm text-gray-900 dark:text-white"
                  placeholder="Enter your custom research prompt..."
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Available variables: {'{subject.name}'}, {'{subject.[field]}'}, {'{bundleContext.title}'}, {'{bundleContext.description}'}
                </p>
              </div>
            )}

            {editingType !== template.type && !prompts[template.type] && (
              <div className="mt-3">
                <p className="text-sm text-gray-600 dark:text-gray-400 italic line-clamp-3">
                  Default: {template.defaultPrompt}
                </p>
              </div>
            )}

            {editingType !== template.type && prompts[template.type] && (
              <div className="mt-3">
                <p className="text-sm text-gray-600 dark:text-gray-400 italic line-clamp-3">
                  Custom: {prompts[template.type]}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
          Pro Tips for Writing Research Prompts
        </h4>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>• Be specific about what information you want to find</li>
          <li>• Include keywords related to your investigation focus</li>
          <li>• Ask for sources and citations to verify information</li>
          <li>• Request structured output with clear sections</li>
          <li>• For legal research, specify jurisdiction and time periods</li>
        </ul>
      </div>
    </div>
  );
}

// Export function to get custom prompts
export function getCustomPrompt(type: ResearchBlockType): string | null {
  if (typeof window === 'undefined') return null;
  
  const saved = localStorage.getItem('researchPromptSettings');
  if (!saved) return null;
  
  const prompts = JSON.parse(saved);
  return prompts[type] || null;
}