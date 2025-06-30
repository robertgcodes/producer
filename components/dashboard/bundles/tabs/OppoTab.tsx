'use client';

import { useState, useEffect } from 'react';
import { Bundle } from '@/types';
import { toast } from 'sonner';

interface OppoTabProps {
  bundle: Bundle;
  onUpdateBundle: (bundleId: string, updates: Partial<Bundle>) => void;
}

interface ResearchSection {
  id: string;
  title: string;
  content: string;
}

interface OppoSubject {
  name: string;
  position?: string;
  organization?: string;
  imageUrl?: string;
}

// Icon mapping for research sections
const sectionIcons: Record<string, JSX.Element> = {
  nonprofit: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  family: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  conflicts: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  financial: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  committees: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  'anti-trump': <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
};

export function OppoTab({ bundle, onUpdateBundle }: OppoTabProps) {
  const [oppoData, setOppoData] = useState(bundle.oppoResearch || {
    subject: null as OppoSubject | null,
    summary: [],
    sections: [] as ResearchSection[]
  });
  
  const [isEditingSection, setIsEditingSection] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [subjectImageFile, setSubjectImageFile] = useState<File | null>(null);

  // Default research sections
  const defaultSections: ResearchSection[] = [
    {
      id: 'nonprofit',
      title: 'Non-Profit Connections',
      content: ''
    },
    {
      id: 'family',
      title: 'Family in Political Positions',
      content: ''
    },
    {
      id: 'conflicts',
      title: 'Conflicts of Interest',
      content: ''
    },
    {
      id: 'financial',
      title: 'Financial Investments',
      content: ''
    },
    {
      id: 'committees',
      title: 'Committee Assignments',
      content: ''
    },
    {
      id: 'anti-trump',
      title: 'Anti-Trump Efforts',
      content: ''
    }
  ];

  // Initialize sections if not present
  useEffect(() => {
    if (!oppoData.sections || oppoData.sections.length === 0) {
      setOppoData(prev => ({
        ...prev,
        sections: defaultSections
      }));
    }
  }, []);

  // Auto-save oppo data only when it actually changes
  useEffect(() => {
    // Skip if oppoData hasn't actually changed from what's in the bundle
    const currentOppoResearch = bundle.oppoResearch || { subject: null, summary: [], sections: [] };
    const hasChanges = JSON.stringify(oppoData) !== JSON.stringify(currentOppoResearch);
    
    if (!hasChanges) return;
    
    const timer = setTimeout(() => {
      console.log('Saving oppo research changes');
      onUpdateBundle(bundle.id, { oppoResearch: oppoData });
    }, 2000); // Increased to 2 seconds for better debouncing

    return () => clearTimeout(timer);
  }, [oppoData, bundle.id, bundle.oppoResearch, onUpdateBundle]);

  const updateSubject = (subject: OppoSubject) => {
    setOppoData(prev => ({ ...prev, subject }));
  };

  const updateSectionContent = (sectionId: string, content: string) => {
    setOppoData(prev => ({
      ...prev,
      sections: prev.sections.map(section =>
        section.id === sectionId ? { ...section, content } : section
      )
    }));
  };

  const generateSummary = async () => {
    if (!oppoData.subject) {
      toast.error('Please add subject information first');
      return;
    }

    setIsGenerating('summary');
    try {
      const response = await fetch('/api/generate-oppo-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: oppoData.subject,
          sections: oppoData.sections.filter(s => s.content.trim())
        })
      });

      if (!response.ok) throw new Error('Failed to generate summary');
      
      const data = await response.json();
      setOppoData(prev => ({ ...prev, summary: data.summary }));
      toast.success('Summary generated');
    } catch (error) {
      console.error('Error generating summary:', error);
      toast.error('Failed to generate summary');
    } finally {
      setIsGenerating(null);
    }
  };

  const generateSectionContent = async (sectionId: string) => {
    if (!oppoData.subject) {
      toast.error('Please add subject information first');
      return;
    }

    setIsGenerating(sectionId);
    try {
      const section = oppoData.sections.find(s => s.id === sectionId);
      const response = await fetch('/api/generate-oppo-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: oppoData.subject,
          sectionTitle: section?.title,
          bundleContext: {
            title: bundle.title,
            description: bundle.description
          }
        })
      });

      if (!response.ok) throw new Error('Failed to generate content');
      
      const data = await response.json();
      updateSectionContent(sectionId, data.content);
      toast.success('Content generated');
    } catch (error) {
      console.error('Error generating content:', error);
      toast.error('Failed to generate content');
      // Mock content for demo
      updateSectionContent(sectionId, `Generated content for ${oppoData.subject.name}...`);
    } finally {
      setIsGenerating(null);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // For demo, create a URL
    const imageUrl = URL.createObjectURL(file);
    updateSubject({ ...oppoData.subject!, imageUrl });
    setSubjectImageFile(file);
    toast.success('Image uploaded');
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-950">
      <div className="max-w-6xl mx-auto p-8 space-y-8">
        {/* Subject Information */}
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Research Subject</h2>
          
          <div className="flex items-start gap-6">
            {/* Subject Image */}
            <div className="flex-shrink-0">
              <div className="relative w-32 h-32 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                {oppoData.subject?.imageUrl ? (
                  <img 
                    src={oppoData.subject.imageUrl} 
                    alt={oppoData.subject.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  title="Upload image"
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">Click to upload</p>
            </div>

            {/* Subject Details */}
            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                <input
                  type="text"
                  value={oppoData.subject?.name || ''}
                  onChange={(e) => updateSubject({ ...oppoData.subject!, name: e.target.value })}
                  placeholder="e.g., Letitia James"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Position</label>
                  <input
                    type="text"
                    value={oppoData.subject?.position || ''}
                    onChange={(e) => updateSubject({ ...oppoData.subject!, position: e.target.value })}
                    placeholder="e.g., Attorney General"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Organization</label>
                  <input
                    type="text"
                    value={oppoData.subject?.organization || ''}
                    onChange={(e) => updateSubject({ ...oppoData.subject!, organization: e.target.value })}
                    placeholder="e.g., New York State"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Section */}
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Executive Summary</h2>
            <button
              onClick={generateSummary}
              disabled={isGenerating === 'summary'}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              {isGenerating === 'summary' ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </>
              ) : (
                'Generate Summary'
              )}
            </button>
          </div>
          
          {oppoData.summary && oppoData.summary.length > 0 ? (
            <ul className="space-y-2">
              {oppoData.summary.map((point, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-brand-600 dark:text-brand-400 mt-0.5">•</span>
                  <span className="text-gray-700 dark:text-gray-300">{point}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 italic">
              No summary yet. Add research content below and generate a summary.
            </p>
          )}
        </div>

        {/* Research Sections */}
        <div className="space-y-6">
          {oppoData.sections.map((section) => (
            <div key={section.id} className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    {sectionIcons[section.id]}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{section.title}</h3>
                </div>
                
                <div className="flex items-center gap-2">
                  {!isEditingSection || isEditingSection !== section.id ? (
                    <>
                      <button
                        onClick={() => generateSectionContent(section.id)}
                        disabled={isGenerating === section.id}
                        className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                      >
                        {isGenerating === section.id ? 'Generating...' : 'AI Generate'}
                      </button>
                      <button
                        onClick={() => setIsEditingSection(section.id)}
                        className="text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                      >
                        Edit
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setIsEditingSection(null)}
                      className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                    >
                      Done
                    </button>
                  )}
                </div>
              </div>
              
              {isEditingSection === section.id ? (
                <textarea
                  value={section.content}
                  onChange={(e) => updateSectionContent(section.id, e.target.value)}
                  placeholder={`Add research about ${section.title.toLowerCase()}...`}
                  className="w-full h-32 px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 resize-none"
                  autoFocus
                />
              ) : (
                <div className="text-gray-700 dark:text-gray-300">
                  {section.content || (
                    <p className="text-gray-400 dark:text-gray-500 italic">
                      No content yet. Click edit to add research or use AI to generate.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}