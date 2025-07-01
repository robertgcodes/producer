'use client';

import { useState, useEffect, type ReactElement } from 'react';
import { ResearchBlock as ResearchBlockType, ResearchBlockTemplate, PromptTemplate } from '@/types';
import { getTemplateByType } from '@/lib/research/templates';
import { Draggable } from '@hello-pangea/dnd';
import { toast } from 'sonner';
import { getPromptTemplates } from '@/components/settings/PromptTemplateManager';
import { BioResearchBlock } from './BioResearchBlock';

interface ResearchBlockProps {
  block: ResearchBlockType;
  index: number;
  onUpdate: (blockId: string, updates: Partial<ResearchBlockType>) => void;
  onDelete: (blockId: string) => void;
  onRegenerate: (blockId: string) => void;
}

const iconMap: Record<string, ReactElement> = {
  'user-circle': <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  gavel: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>,
  building: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  scales: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>,
  briefcase: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  'user-x': <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" /></svg>,
  heart: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>,
  flag: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>,
  'building-2': <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" /></svg>,
  users: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  'plus-circle': <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
};

export function ResearchBlock({ block, index, onUpdate, onDelete, onRegenerate }: ResearchBlockProps) {
  // Use specialized Bio block for bio type
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [showPromptSelector, setShowPromptSelector] = useState(false);

  useEffect(() => {
    setPromptTemplates(getPromptTemplates());
  }, []);

  if (block.type === 'bio') {
    return <BioResearchBlock block={block} index={index} onUpdate={onUpdate} onDelete={onDelete} onRegenerate={onRegenerate} />;
  }
  
  const template = getTemplateByType(block.type);
  if (!template) return null;

  const getStatusColor = () => {
    switch (block.research.status) {
      case 'completed': return 'text-green-600 dark:text-green-400';
      case 'loading': return 'text-blue-600 dark:text-blue-400';
      case 'error': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getStatusText = () => {
    switch (block.research.status) {
      case 'completed': return 'Research completed';
      case 'loading': return 'Researching...';
      case 'error': return 'Error occurred';
      default: return 'Not started';
    }
  };

  return (
    <Draggable draggableId={block.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`bg-white dark:bg-gray-900 rounded-xl shadow-sm mb-4 ${
            snapshot.isDragging ? 'shadow-lg' : ''
          }`}
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Drag Handle */}
                <div
                  {...provided.dragHandleProps}
                  className="cursor-move p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                  </svg>
                </div>
                
                {/* Icon and Title */}
                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  {iconMap[template.icon]}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {block.subject.name || template.name}
                  </h3>
                  <p className={`text-sm ${getStatusColor()}`}>{getStatusText()}</p>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                >
                  <svg 
                    className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {block.research.status === 'completed' && (
                  <button
                    onClick={() => onRegenerate(block.id)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                    title="Regenerate research"
                  >
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                )}
                
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                  title="Edit"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this research block?')) {
                      onDelete(block.id);
                    }
                  }}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                  title="Delete"
                >
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          
          {/* Content */}
          {isExpanded && (
            <div className="p-4">
              {isEditing ? (
                <div className="space-y-4">
                  {/* Edit Fields */}
                  {template.fields.map(field => (
                    <div key={field.id}>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {field.label}
                      </label>
                      {field.type === 'textarea' ? (
                        <textarea
                          value={block.subject[field.id] || ''}
                          onChange={(e) => onUpdate(block.id, {
                            subject: { ...block.subject, [field.id]: e.target.value }
                          })}
                          placeholder={field.placeholder}
                          className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-white"
                          rows={3}
                        />
                      ) : field.type === 'select' ? (
                        <select
                          value={block.subject[field.id] || ''}
                          onChange={(e) => onUpdate(block.id, {
                            subject: { ...block.subject, [field.id]: e.target.value }
                          })}
                          className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-white"
                        >
                          <option value="">Select {field.label}</option>
                          {field.options?.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type}
                          value={block.subject[field.id] || ''}
                          onChange={(e) => onUpdate(block.id, {
                            subject: { ...block.subject, [field.id]: e.target.value }
                          })}
                          placeholder={field.placeholder}
                          className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-white"
                        />
                      )}
                    </div>
                  ))}
                  
                  {/* Custom Prompt */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Research Prompt
                      </label>
                      {promptTemplates.length > 0 && (
                        <button
                          onClick={() => setShowPromptSelector(!showPromptSelector)}
                          className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                        >
                          {showPromptSelector ? 'Hide Templates' : 'Use Template'}
                        </button>
                      )}
                    </div>
                    
                    {showPromptSelector && (
                      <div className="mb-3 p-3 bg-gray-100 dark:bg-gray-900 rounded-lg max-h-48 overflow-y-auto">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Select a template:</p>
                        <div className="space-y-2">
                          {promptTemplates.map(pt => (
                            <button
                              key={pt.id}
                              onClick={() => {
                                onUpdate(block.id, { customPrompt: pt.prompt });
                                setShowPromptSelector(false);
                                toast.success('Template applied');
                              }}
                              className="w-full text-left p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded transition-colors"
                            >
                              <div className="font-medium text-sm text-gray-900 dark:text-white">
                                {pt.title}
                              </div>
                              {pt.description && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {pt.description}
                                </div>
                              )}
                              {pt.category && (
                                <span className="inline-block mt-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">
                                  {pt.category}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <textarea
                      value={block.customPrompt || ''}
                      onChange={(e) => onUpdate(block.id, { customPrompt: e.target.value })}
                      placeholder="Enter custom research instructions or select a template above..."
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                      rows={4}
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Leave empty to use the default prompt for {template.name}
                    </p>
                  </div>
                  
                  <button
                    onClick={() => setIsEditing(false)}
                    className="btn-primary"
                  >
                    Save Changes
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Research Results */}
                  {block.research.status === 'loading' && (
                    <div className="flex items-center justify-center py-8">
                      <svg className="animate-spin h-8 w-8 text-brand-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  )}
                  
                  {block.research.status === 'completed' && block.research.data && (
                    <>
                      {/* Summary */}
                      {block.research.data.summary.length > 0 && (
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white mb-2">Key Findings</h4>
                          <ul className="space-y-1">
                            {block.research.data.summary.map((point, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-brand-600 dark:text-brand-400 mt-0.5">•</span>
                                <span className="text-gray-700 dark:text-gray-300 text-sm">{point}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {/* Sections */}
                      {block.research.data.sections.map(section => (
                        <div key={section.id}>
                          <h4 className="font-medium text-gray-900 dark:text-white mb-2">{section.title}</h4>
                          <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap">
                            {section.content}
                          </p>
                          
                          {/* Sources */}
                          {section.sources && section.sources.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Sources:</p>
                              <div className="space-y-1">
                                {section.sources.map((source, idx) => (
                                  <a
                                    key={idx}
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 block"
                                  >
                                    {source.title}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      
                      {/* Metadata */}
                      {block.research.data.metadata && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                            {block.research.data.metadata.totalSources && (
                              <span>{block.research.data.metadata.totalSources} sources analyzed</span>
                            )}
                            {block.research.data.metadata.confidence && (
                              <span>Confidence: {block.research.data.metadata.confidence}</span>
                            )}
                            {block.research.lastUpdated && (
                              <span>Updated: {new Date(block.research.lastUpdated).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  
                  {block.research.status === 'error' && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <p className="text-red-600 dark:text-red-400 text-sm">
                        {block.research.error || 'An error occurred during research'}
                      </p>
                    </div>
                  )}
                  
                  {block.research.status === 'pending' && (
                    <div className="text-center py-8">
                      <p className="text-gray-500 dark:text-gray-400 mb-4">
                        Research not started yet
                      </p>
                      <button
                        onClick={() => onRegenerate(block.id)}
                        className="btn-primary"
                      >
                        Start Research
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}