'use client';

import { useState, useRef } from 'react';
import { ResearchBlock as ResearchBlockType } from '@/types';
import { Draggable } from '@hello-pangea/dnd';
import { toast } from 'sonner';

interface BioResearchBlockProps {
  block: ResearchBlockType;
  index: number;
  onUpdate: (blockId: string, updates: Partial<ResearchBlockType>) => void;
  onDelete: (blockId: string) => void;
  onRegenerate: (blockId: string) => void;
}

interface BioField {
  id: string;
  label: string;
  value: string;
  type: 'text' | 'textarea' | 'section'; // Added section type
  loading?: boolean;
  colSpan?: 1 | 2 | 3 | 4; // Grid column span
}

export function BioResearchBlock({ block, index, onUpdate, onDelete, onRegenerate }: BioResearchBlockProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [fieldStates, setFieldStates] = useState<Record<string, boolean>>({});
  const [loadingMessage, setLoadingMessage] = useState('');
  const [wikipediaUrl, setWikipediaUrl] = useState(block.subject.wikipediaUrl || '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const bioFields: BioField[] = [
    // Personal Information Section
    { id: 'personal-section', label: 'Personal Information', value: '', type: 'section', colSpan: 4 },
    { id: 'dob', label: 'Date of Birth', value: block.subject.dob || '', type: 'text', colSpan: 1 },
    { id: 'birthplace', label: 'Birthplace', value: block.subject.birthplace || '', type: 'text', colSpan: 2 },
    { id: 'residence', label: 'Current Residence', value: block.subject.residence || '', type: 'text', colSpan: 1 },
    
    // Professional Section
    { id: 'professional-section', label: 'Professional Background', value: '', type: 'section', colSpan: 4 },
    { id: 'occupation', label: 'Current Occupation', value: block.subject.occupation || '', type: 'text', colSpan: 2 },
    { id: 'netWorth', label: 'Net Worth', value: block.subject.netWorth || '', type: 'text', colSpan: 1 },
    { id: 'militaryService', label: 'Military Service', value: block.subject.militaryService || '', type: 'text', colSpan: 1 },
    { id: 'pastProfessions', label: 'Past Professions', value: block.subject.pastProfessions || '', type: 'textarea', colSpan: 4 },
    
    // Affiliations Section
    { id: 'affiliations-section', label: 'Affiliations & Beliefs', value: '', type: 'section', colSpan: 4 },
    { id: 'religion', label: 'Religion', value: block.subject.religion || '', type: 'text', colSpan: 1 },
    { id: 'politicalParty', label: 'Political Party', value: block.subject.politicalParty || '', type: 'text', colSpan: 1 },
    { id: 'politicalAffiliations', label: 'Political Affiliations', value: block.subject.politicalAffiliations || '', type: 'textarea', colSpan: 2 },
    
    // Family Section
    { id: 'family-section', label: 'Family Information', value: '', type: 'section', colSpan: 4 },
    { id: 'marriageStatus', label: 'Marriage Status', value: block.subject.marriageStatus || '', type: 'text', colSpan: 1 },
    { id: 'spouse', label: 'Spouse Name', value: block.subject.spouse || '', type: 'text', colSpan: 1 },
    { id: 'children', label: 'Children', value: block.subject.children || '', type: 'textarea', colSpan: 2 },
    { id: 'parents', label: 'Parents', value: block.subject.parents || '', type: 'textarea', colSpan: 2 },
    { id: 'siblings', label: 'Siblings', value: block.subject.siblings || '', type: 'textarea', colSpan: 2 },
    
    // Additional Information Section
    { id: 'additional-section', label: 'Education & Achievements', value: '', type: 'section', colSpan: 4 },
    { id: 'education', label: 'Education', value: block.subject.education || '', type: 'textarea', colSpan: 4 },
    { id: 'awards', label: 'Awards & Honors', value: block.subject.awards || '', type: 'textarea', colSpan: 4 },
    { id: 'memberships', label: 'Memberships & Affiliations', value: block.subject.memberships || '', type: 'textarea', colSpan: 4 },
    { id: 'notes', label: 'Additional Notes', value: block.subject.notes || '', type: 'textarea', colSpan: 4 }
  ];

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Convert to base64 for storage
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      onUpdate(block.id, {
        subject: { ...block.subject, photoUrl: base64 }
      });
      toast.success('Photo uploaded');
    };
    reader.readAsDataURL(file);
  };

  const handleAIFill = async () => {
    if (!block.subject.name) {
      toast.error('Please enter a name first');
      return;
    }

    setIsGenerating(true);
    setLoadingMessage('Searching Wikipedia...');
    
    // Update loading message after a bit
    setTimeout(() => {
      if (isGenerating) {
        setLoadingMessage('Analyzing with AI...');
      }
    }, 3000);
    
    // Show loading state for all fields (except sections)
    const loadingStates: Record<string, boolean> = {};
    bioFields.forEach(field => {
      if (field.type !== 'section') {
        loadingStates[field.id] = true;
      }
    });
    setFieldStates(loadingStates);

    try {
      // Add timeout to prevent infinite loading
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        setLoadingMessage('Request taking longer than expected...');
      }, 20000); // 20 second timeout

      const response = await fetch('/api/research/bio-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          name: block.subject.name,
          existingData: block.subject
        })
      });

      clearTimeout(timeoutId);

      if (!response.ok) throw new Error('Failed to fetch bio data');
      
      setLoadingMessage('Processing data...');
      
      const data = await response.json();
      
      // Update photo if provided
      if (data.photoUrl && !block.subject.photoUrl) {
        onUpdate(block.id, {
          subject: { ...block.subject, photoUrl: data.photoUrl }
        });
      }
      
      // Update Wikipedia URL if provided
      if (data.wikipediaUrl) {
        setWikipediaUrl(data.wikipediaUrl);
      }
      
      // Update fields with animation
      const updatedSubject = { ...block.subject };
      for (const field of bioFields) {
        if (field.type !== 'section' && data[field.id]) {
          updatedSubject[field.id] = data[field.id];
          setTimeout(() => {
            setFieldStates(prev => ({ ...prev, [field.id]: false }));
          }, Math.random() * 1000); // Stagger updates for effect
        }
      }
      
      // Update all at once to avoid multiple rerenders
      onUpdate(block.id, {
        subject: { ...updatedSubject, ...data }
      });
      
      toast.success('Bio information filled with comprehensive data');
    } catch (error: any) {
      console.error('Error filling bio:', error);
      
      if (error.name === 'AbortError') {
        toast.error('Request timed out. Please try again.');
      } else {
        toast.error('Failed to fetch bio data. Please try again.');
      }
      
      // Clear loading states on error
      setFieldStates({});
    } finally {
      setIsGenerating(false);
      setLoadingMessage('');
    }
  };

  const handleFieldChange = (fieldId: string, value: string) => {
    onUpdate(block.id, {
      subject: { ...block.subject, [fieldId]: value }
    });
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
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-t-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Drag Handle */}
                <div
                  {...provided.dragHandleProps}
                  className="cursor-move p-1 hover:bg-white/50 dark:hover:bg-gray-800/50 rounded"
                >
                  <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                  </svg>
                </div>
                
                {/* Photo and Name */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {block.subject.photoUrl ? (
                      <img
                        src={block.subject.photoUrl}
                        alt={block.subject.name}
                        className="w-16 h-16 rounded-full object-cover border-2 border-white dark:border-gray-800"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center border-2 border-white dark:border-gray-800">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    )}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -bottom-1 -right-1 p-1 bg-white dark:bg-gray-800 rounded-full shadow-md hover:shadow-lg transition-shadow"
                      title="Upload photo"
                    >
                      <svg className="w-3 h-3 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </div>
                  
                  <div className="flex-1">
                    <input
                      type="text"
                      value={block.subject.name || ''}
                      onChange={(e) => handleFieldChange('name', e.target.value)}
                      placeholder="Enter full name..."
                      className="text-lg font-semibold bg-transparent border-0 focus:outline-none focus:ring-0 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 w-full"
                    />
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Biography</p>
                      {wikipediaUrl && (
                        <a
                          href={wikipediaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          Wikipedia
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAIFill}
                  disabled={isGenerating || !block.subject.name}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                    isGenerating
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {isGenerating ? (
                    <>
                      <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="truncate max-w-[100px]">{loadingMessage || 'Filling...'}</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      AI Fill
                    </>
                  )}
                </button>
                
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
                
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this bio block?')) {
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
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {bioFields.map(field => {
                  if (field.type === 'section') {
                    return (
                      <div key={field.id} className="col-span-full mt-4 first:mt-0">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-1 mb-3">
                          {field.label}
                        </h3>
                      </div>
                    );
                  }
                  
                  return (
                    <div
                      key={field.id}
                      className={`${
                        field.colSpan === 4 ? 'md:col-span-2 lg:col-span-4' : 
                        field.colSpan === 3 ? 'md:col-span-2 lg:col-span-3' :
                        field.colSpan === 2 ? 'md:col-span-2 lg:col-span-2' :
                        'md:col-span-1 lg:col-span-1'
                      } ${fieldStates[field.id] ? 'animate-pulse' : ''}`}
                    >
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        {field.label}
                      </label>
                      {field.type === 'textarea' ? (
                      <textarea
                        value={field.value}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder-gray-400 dark:placeholder-gray-500 text-sm text-gray-900 dark:text-white resize-none"
                        rows={
                          field.id === 'notes' ? 3 : 
                          field.id === 'awards' || field.id === 'memberships' ? 3 :
                          2
                        }
                        disabled={fieldStates[field.id]}
                      />
                    ) : (
                      <input
                        type="text"
                        value={field.value}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder-gray-400 dark:placeholder-gray-500 text-sm text-gray-900 dark:text-white"
                        disabled={fieldStates[field.id]}
                      />
                    )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}