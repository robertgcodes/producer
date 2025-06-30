'use client';

import { useState, useEffect } from 'react';
import { Bundle, ResearchBlock as ResearchBlockType, ResearchBlockType as BlockType } from '@/types';
import { ResearchBlock } from '../research/ResearchBlock';
import { researchBlockTemplates } from '@/lib/research/templates';
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { getDefaultPrompt } from '@/components/settings/PromptTemplateManager';
import { SettingsModal } from '@/components/settings/SettingsModal';

interface ResearchTabProps {
  bundle: Bundle;
  onUpdateBundle: (bundleId: string, updates: Partial<Bundle>) => void;
}

export function ResearchTab({ bundle, onUpdateBundle }: ResearchTabProps) {
  const [researchBlocks, setResearchBlocks] = useState<ResearchBlockType[]>(
    bundle.researchBlocks || []
  );
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Sync research blocks when bundle changes
  useEffect(() => {
    setResearchBlocks(bundle.researchBlocks || []);
  }, [bundle.id]); // Only update when bundle ID changes

  // Auto-save research blocks
  useEffect(() => {
    const hasChanges = JSON.stringify(researchBlocks) !== JSON.stringify(bundle.researchBlocks || []);
    
    if (!hasChanges) return;
    
    const timer = setTimeout(() => {
      onUpdateBundle(bundle.id, { researchBlocks });
    }, 2000);

    return () => clearTimeout(timer);
  }, [researchBlocks, bundle.id, bundle.researchBlocks, onUpdateBundle]);

  const handleAddBlock = (type: BlockType) => {
    const template = researchBlockTemplates.find(t => t.type === type);
    if (!template) return;

    // Get custom default prompt if available
    const customDefaultPrompt = getDefaultPrompt(type);

    const newBlock: ResearchBlockType = {
      id: uuidv4(),
      type,
      order: researchBlocks.length,
      subject: { name: '' },
      ...(customDefaultPrompt && { customPrompt: customDefaultPrompt }),
      research: {
        status: 'pending'
      }
    };

    setResearchBlocks([...researchBlocks, newBlock]);
    setShowAddMenu(false);
    toast.success(`Added ${template.name} research block`);
  };

  const handleUpdateBlock = (blockId: string, updates: Partial<ResearchBlockType>) => {
    setResearchBlocks(blocks =>
      blocks.map(block =>
        block.id === blockId ? { ...block, ...updates } : block
      )
    );
  };

  const handleDeleteBlock = (blockId: string) => {
    setResearchBlocks(blocks => {
      const filtered = blocks.filter(b => b.id !== blockId);
      // Reorder remaining blocks
      return filtered.map((block, index) => ({ ...block, order: index }));
    });
    toast.success('Research block removed');
  };

  const handleRegenerateBlock = async (blockId: string) => {
    const block = researchBlocks.find(b => b.id === blockId);
    if (!block) return;

    // Update block status to loading
    handleUpdateBlock(blockId, {
      research: { ...block.research, status: 'loading' }
    });

    try {
      // TODO: Implement Perplexity API call
      const response = await fetch('/api/research/perplexity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blockType: block.type,
          subject: block.subject,
          customPrompt: block.customPrompt,
          bundleContext: {
            title: bundle.title,
            description: bundle.description
          }
        })
      });

      if (!response.ok) throw new Error('Research failed');

      const data = await response.json();
      
      handleUpdateBlock(blockId, {
        research: {
          status: 'completed',
          lastUpdated: new Date(),
          data: data.research
        }
      });
      
      toast.success('Research completed');
    } catch (error) {
      console.error('Research error:', error);
      
      // For now, mock the response
      const mockData = {
        summary: [
          `${block.subject.name} is a key figure in this matter`,
          'Multiple connections to relevant organizations identified',
          'Further investigation recommended on financial disclosures'
        ],
        sections: [
          {
            id: 'background',
            title: 'Background',
            content: `Comprehensive background information about ${block.subject.name}...`,
            sources: [
              { title: 'Source 1', url: 'https://example.com/1' },
              { title: 'Source 2', url: 'https://example.com/2' }
            ]
          },
          {
            id: 'connections',
            title: 'Key Connections',
            content: 'Notable connections and affiliations discovered during research...'
          }
        ],
        metadata: {
          totalSources: 15,
          confidence: 'high' as const
        }
      };
      
      handleUpdateBlock(blockId, {
        research: {
          status: 'completed',
          lastUpdated: new Date(),
          data: mockData
        }
      });
      
      toast.success('Research completed (demo data)');
    }
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(researchBlocks);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update order property
    const reordered = items.map((item, index) => ({
      ...item,
      order: index
    }));

    setResearchBlocks(reordered);
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-950">
      <div className="max-w-6xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Research Center
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Add research blocks to investigate people, organizations, and entities related to your bundle
              </p>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Research Settings"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Add Research Block Button */}
        <div className="mb-6 relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="btn-primary flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Research Block
          </button>

          {/* Add Menu */}
          {showAddMenu && (
            <div className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 z-10">
              <div className="p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-3">
                  Select Research Type
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {researchBlockTemplates.map(template => (
                    <button
                      key={template.type}
                      onClick={() => handleAddBlock(template.type)}
                      className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <div className="font-medium text-gray-900 dark:text-white">
                        {template.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {template.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Research Blocks */}
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="research-blocks">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-4"
              >
                {researchBlocks.length === 0 ? (
                  <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-xl">
                    <svg className="w-16 h-16 text-gray-300 dark:text-gray-700 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No Research Blocks Yet
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">
                      Add research blocks to investigate people and organizations
                    </p>
                    <button
                      onClick={() => setShowAddMenu(true)}
                      className="btn-secondary"
                    >
                      Add Your First Block
                    </button>
                  </div>
                ) : (
                  <>
                    {researchBlocks
                      .sort((a, b) => a.order - b.order)
                      .map((block, index) => (
                        <ResearchBlock
                          key={block.id}
                          block={block}
                          index={index}
                          onUpdate={handleUpdateBlock}
                          onDelete={handleDeleteBlock}
                          onRegenerate={handleRegenerateBlock}
                        />
                      ))}
                  </>
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>
      
      {/* Settings Modal */}
      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
      />
    </div>
  );
}