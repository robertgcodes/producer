'use client';

import { useState, useEffect } from 'react';
import { PromptTemplate, ResearchBlockType } from '@/types';
import { researchBlockTemplates } from '@/lib/research/templates';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

interface PromptTemplateManagerProps {
  onClose?: () => void;
}

export function PromptTemplateManager({ onClose }: PromptTemplateManagerProps) {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [defaultPrompts, setDefaultPrompts] = useState<Record<ResearchBlockType, string>>({
    bio: '',
    judge: '',
    politician: '',
    nonprofit: '',
    federal_agency: '',
    prosecutor: '',
    defense_attorney: '',
    criminal_defendant: '',
    related_persons: '',
    institution: '',
    statute: '',
    custom: ''
  });
  const [activeTab, setActiveTab] = useState<'templates' | 'defaults'>('templates');
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Load saved data from localStorage
  useEffect(() => {
    const savedTemplates = localStorage.getItem('promptTemplates');
    const savedDefaults = localStorage.getItem('defaultResearchPrompts');
    
    if (savedTemplates) {
      const parsed = JSON.parse(savedTemplates);
      setTemplates(parsed.map((t: any) => ({
        ...t,
        createdAt: new Date(t.createdAt),
        updatedAt: new Date(t.updatedAt)
      })));
    }
    
    if (savedDefaults) {
      setDefaultPrompts(JSON.parse(savedDefaults));
    }
  }, []);

  const saveTemplates = (newTemplates: PromptTemplate[]) => {
    setTemplates(newTemplates);
    localStorage.setItem('promptTemplates', JSON.stringify(newTemplates));
  };

  const saveDefaultPrompts = (newDefaults: Record<ResearchBlockType, string>) => {
    setDefaultPrompts(newDefaults);
    localStorage.setItem('defaultResearchPrompts', JSON.stringify(newDefaults));
  };

  const handleCreateTemplate = () => {
    const newTemplate: PromptTemplate = {
      id: uuidv4(),
      title: '',
      description: '',
      prompt: '',
      category: 'General',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    setEditingTemplate(newTemplate);
    setIsCreating(true);
  };

  const handleSaveTemplate = () => {
    if (!editingTemplate) return;
    
    if (!editingTemplate.title.trim()) {
      toast.error('Please enter a title for the template');
      return;
    }
    
    if (!editingTemplate.prompt.trim()) {
      toast.error('Please enter a prompt for the template');
      return;
    }

    const updatedTemplates = isCreating
      ? [...templates, editingTemplate]
      : templates.map(t => t.id === editingTemplate.id ? editingTemplate : t);
    
    saveTemplates(updatedTemplates);
    setEditingTemplate(null);
    setIsCreating(false);
    toast.success(isCreating ? 'Template created' : 'Template updated');
  };

  const handleDeleteTemplate = (id: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      const filtered = templates.filter(t => t.id !== id);
      saveTemplates(filtered);
      toast.success('Template deleted');
    }
  };

  const handleDuplicateTemplate = (template: PromptTemplate) => {
    const duplicate: PromptTemplate = {
      ...template,
      id: uuidv4(),
      title: `${template.title} (Copy)`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    saveTemplates([...templates, duplicate]);
    toast.success('Template duplicated');
  };

  const handleUpdateDefaultPrompt = (type: ResearchBlockType, prompt: string) => {
    const updated = { ...defaultPrompts, [type]: prompt };
    saveDefaultPrompts(updated);
  };

  const handleResetDefaultPrompt = (type: ResearchBlockType) => {
    const updated = { ...defaultPrompts };
    delete updated[type];
    saveDefaultPrompts(updated);
    toast.success('Reset to original default prompt');
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Prompt Template Manager
          </h2>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        
        {/* Tabs */}
        <div className="flex gap-4 mt-4">
          <button
            onClick={() => setActiveTab('templates')}
            className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'templates'
                ? 'text-brand-600 dark:text-brand-400 border-brand-600 dark:border-brand-400'
                : 'text-gray-500 dark:text-gray-400 border-transparent'
            }`}
          >
            Custom Templates
          </button>
          <button
            onClick={() => setActiveTab('defaults')}
            className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'defaults'
                ? 'text-brand-600 dark:text-brand-400 border-brand-600 dark:border-brand-400'
                : 'text-gray-500 dark:text-gray-400 border-transparent'
            }`}
          >
            Default Prompts
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'templates' ? (
          <div className="p-6">
            {/* Create Button */}
            <button
              onClick={handleCreateTemplate}
              className="btn-primary mb-6 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create New Template
            </button>

            {/* Template List */}
            {editingTemplate ? (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6">
                <h3 className="font-medium text-gray-900 dark:text-white mb-4">
                  {isCreating ? 'Create New Template' : 'Edit Template'}
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      value={editingTemplate.title}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, title: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-white"
                      placeholder="e.g., Deep Political Background Check"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={editingTemplate.description}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-white"
                      placeholder="Brief description of what this template does"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Category
                    </label>
                    <select
                      value={editingTemplate.category || 'General'}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, category: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-white"
                    >
                      <option value="General">General</option>
                      <option value="Legal">Legal</option>
                      <option value="Political">Political</option>
                      <option value="Financial">Financial</option>
                      <option value="Personal">Personal</option>
                      <option value="Organization">Organization</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Tags (comma separated)
                    </label>
                    <input
                      type="text"
                      value={editingTemplate.tags?.join(', ') || ''}
                      onChange={(e) => setEditingTemplate({ 
                        ...editingTemplate, 
                        tags: e.target.value.split(',').map(t => t.trim()).filter(t => t) 
                      })}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-white"
                      placeholder="e.g., detailed, financial, investigation"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Prompt Template
                    </label>
                    <textarea
                      value={editingTemplate.prompt}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, prompt: e.target.value })}
                      className="w-full h-64 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono text-sm text-gray-900 dark:text-white"
                      placeholder="Enter your research prompt template here..."
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Available variables: {'{subject.name}'}, {'{subject.[field]}'}, {'{bundleContext.title}'}, {'{bundleContext.description}'}
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleSaveTemplate}
                    className="btn-primary"
                  >
                    {isCreating ? 'Create Template' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => {
                      setEditingTemplate(null);
                      setIsCreating(false);
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {templates.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-gray-500 dark:text-gray-400">No custom templates yet</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Create templates to reuse across research blocks</p>
                  </div>
                ) : (
                  templates.map(template => (
                    <div
                      key={template.id}
                      className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {template.title}
                          </h4>
                          {template.description && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              {template.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2">
                            {template.category && (
                              <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded">
                                {template.category}
                              </span>
                            )}
                            {template.tags && template.tags.length > 0 && (
                              <div className="flex gap-2">
                                {template.tags.map(tag => (
                                  <span key={tag} className="text-xs text-gray-500 dark:text-gray-400">
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => {
                              setEditingTemplate(template);
                              setIsCreating(false);
                            }}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDuplicateTemplate(template)}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                            title="Duplicate"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-red-500"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="p-6">
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Customize the default prompts for each research block type. These will be used when creating new blocks.
            </p>
            
            <div className="space-y-6">
              {researchBlockTemplates.map(template => {
                const hasCustomDefault = defaultPrompts[template.type];
                const currentPrompt = defaultPrompts[template.type] || template.defaultPrompt;

                return (
                  <div key={template.type} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {template.name}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {template.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasCustomDefault && (
                          <span className="text-xs bg-brand-100 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 px-2 py-1 rounded">
                            Customized
                          </span>
                        )}
                        {hasCustomDefault && (
                          <button
                            onClick={() => handleResetDefaultPrompt(template.type)}
                            className="text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                          >
                            Reset to Default
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-600 dark:text-gray-400 italic line-clamp-3">
                      {currentPrompt}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Export helper functions
export function getPromptTemplates(): PromptTemplate[] {
  if (typeof window === 'undefined') return [];
  
  const saved = localStorage.getItem('promptTemplates');
  if (!saved) return [];
  
  return JSON.parse(saved).map((t: any) => ({
    ...t,
    createdAt: new Date(t.createdAt),
    updatedAt: new Date(t.updatedAt)
  }));
}

export function getDefaultPrompt(type: ResearchBlockType): string | null {
  if (typeof window === 'undefined') return null;
  
  const saved = localStorage.getItem('defaultResearchPrompts');
  if (!saved) return null;
  
  const defaults = JSON.parse(saved);
  return defaults[type] || null;
}