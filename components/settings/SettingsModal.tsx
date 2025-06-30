'use client';

import { useState } from 'react';
import { PromptTemplateManager } from './PromptTemplateManager';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'prompts'>('prompts');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      {/* Modal */}
      <div className="absolute inset-4 md:inset-8 lg:inset-16 bg-white dark:bg-gray-900 rounded-xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Settings
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-6 mt-4">
            <button
              onClick={() => setActiveTab('general')}
              className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'general'
                  ? 'text-brand-600 dark:text-brand-400 border-brand-600 dark:border-brand-400'
                  : 'text-gray-500 dark:text-gray-400 border-transparent'
              }`}
            >
              General
            </button>
            <button
              onClick={() => setActiveTab('prompts')}
              className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'prompts'
                  ? 'text-brand-600 dark:text-brand-400 border-brand-600 dark:border-brand-400'
                  : 'text-gray-500 dark:text-gray-400 border-transparent'
              }`}
            >
              Research Prompts
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'general' ? (
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                General Settings
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                General settings will be added here.
              </p>
            </div>
          ) : (
            <PromptTemplateManager />
          )}
        </div>
      </div>
    </div>
  );
}