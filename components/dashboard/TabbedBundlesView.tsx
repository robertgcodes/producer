'use client';

import { useState, useEffect } from 'react';
import { Bundle, ContentItem } from '@/types';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { BundleSearchService } from '@/lib/services/bundleSearchService';
import { EntityExtractionService, ExtractedEntity } from '@/lib/services/entityExtractionService';
import { ImageSearchService, ImageResult } from '@/lib/services/imageSearchService';
import { cleanFirestoreData } from '@/lib/utils/firebaseHelpers';
import { TitleGenerationSettings } from './TitleGenerationSettings';

interface TabbedBundlesViewProps {
  activeProject: any;
  bundles: Bundle[];
  bundleStories: Record<string, ContentItem[]>;
  isLoadingBundles: boolean;
  onDeleteStory: (storyId: string) => void;
}

export function TabbedBundlesView({ 
  activeProject, 
  bundles, 
  bundleStories, 
  isLoadingBundles,
  onDeleteStory 
}: TabbedBundlesViewProps) {
  const [activeBundle, setActiveBundle] = useState<string | null>(null);
  const [showAddBundle, setShowAddBundle] = useState(false);
  const [bundleTitle, setBundleTitle] = useState('');
  const [bundleDescription, setBundleDescription] = useState('');
  const [editingBundle, setEditingBundle] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [suggestedStories, setSuggestedStories] = useState<ContentItem[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [aiResults, setAiResults] = useState<any>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [showAIResults, setShowAIResults] = useState(false);
  const [showAddStory, setShowAddStory] = useState(false);
  const [storyUrl, setStoryUrl] = useState('');
  const [storyTitle, setStoryTitle] = useState('');
  const [storyType, setStoryType] = useState<ContentItem['sourceType']>('article');
  
  // New state for enhanced features
  const [extractedEntities, setExtractedEntities] = useState<ExtractedEntity[]>([]);
  const [selectedEntities, setSelectedEntities] = useState<Set<string>>(new Set());
  const [entityImages, setEntityImages] = useState<Record<string, ImageResult[]>>({});
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());
  const [generatedTitles, setGeneratedTitles] = useState<string[]>([]);
  const [isGeneratingTitles, setIsGeneratingTitles] = useState(false);
  const [perplexityPrompts, setPerplexityPrompts] = useState([
    { id: '1', title: 'Constitutional Analysis', prompt: 'What constitutional provisions and legal precedents are relevant to these stories?' },
    { id: '2', title: 'Key Arguments', prompt: 'What are the main arguments from different perspectives on this issue?' }
  ]);
  const [perplexityResults, setPerplexityResults] = useState<Record<string, any>>({});
  const [loadingPerplexity, setLoadingPerplexity] = useState<Set<string>>(new Set());
  
  // Story selector state
  const [storySortBy, setStorySortBy] = useState<'date' | 'relevance' | 'source'>('relevance');
  const [storyFilterBy, setStoryFilterBy] = useState<'all' | 'article' | 'video' | 'tweet' | 'social'>('all');
  const [storySearchQuery, setStorySearchQuery] = useState('');
  const [activeStoryTab, setActiveStoryTab] = useState<'all' | 'selected'>('all');

  // Set the first bundle as active by default
  useEffect(() => {
    if (bundles.length > 0 && !activeBundle) {
      setActiveBundle(bundles[0].id);
    }
  }, [bundles, activeBundle]);

  // Extract entities when stories change
  useEffect(() => {
    if (activeBundle && bundleStories[activeBundle]) {
      const stories = bundleStories[activeBundle];
      if (stories.length > 0) {
        const entities = EntityExtractionService.extractEntitiesFromStories(stories);
        setExtractedEntities(entities);
        
        // Auto-select top 3 entities
        const topEntities = entities.slice(0, 3);
        setSelectedEntities(new Set(topEntities.map(e => e.id)));
      }
    }
  }, [activeBundle, bundleStories]);

  // Auto-search images for selected entities
  useEffect(() => {
    selectedEntities.forEach(entityId => {
      const entity = extractedEntities.find(e => e.id === entityId);
      if (entity && !entityImages[entityId] && !loadingImages.has(entityId)) {
        searchImagesForEntity(entity);
      }
    });
  }, [selectedEntities, extractedEntities]);

  // Listen for custom event to open add bundle modal
  useEffect(() => {
    const handleOpenAddBundle = () => setShowAddBundle(true);
    window.addEventListener('openAddBundle', handleOpenAddBundle);
    return () => window.removeEventListener('openAddBundle', handleOpenAddBundle);
  }, []);

  const handleCreateBundle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !bundleTitle.trim()) return;

    try {
      const bundleData = {
        projectId: activeProject.id,
        title: bundleTitle,
        description: bundleDescription,
        theme: '',
        priority: 'growing' as Bundle['priority'],
        estimatedTime: 10,
        order: bundles.length,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const docRef = await addDoc(collection(db, 'bundles'), bundleData);
      setBundleTitle('');
      setBundleDescription('');
      setShowAddBundle(false);
      setActiveBundle(docRef.id);
      toast.success('Bundle created successfully');
    } catch (error: any) {
      console.error('Error creating bundle: ', error);
      toast.error(`Failed to create bundle: ${error.message}`);
    }
  };

  const handleDeleteBundle = async (bundleId: string) => {
    if (!confirm('Are you sure you want to delete this bundle and all its stories?')) return;
    
    try {
      // Delete all stories in the bundle first
      const stories = bundleStories[bundleId] || [];
      for (const story of stories) {
        await deleteDoc(doc(db, 'contentItems', story.id));
      }
      
      // Delete the bundle
      await deleteDoc(doc(db, 'bundles', bundleId));
      
      // Set active bundle to the first remaining bundle
      const remainingBundles = bundles.filter(b => b.id !== bundleId);
      if (remainingBundles.length > 0) {
        setActiveBundle(remainingBundles[0].id);
      } else {
        setActiveBundle(null);
      }
      
      toast.success('Bundle deleted successfully');
    } catch (error) {
      console.error('Error deleting bundle:', error);
      toast.error('Failed to delete bundle');
    }
  };

  const handleUpdateBundle = async (bundleId: string) => {
    if (!editTitle.trim()) return;

    try {
      await updateDoc(doc(db, 'bundles', bundleId), {
        title: editTitle,
        description: editDescription,
        updatedAt: new Date()
      });
      setEditingBundle(null);
      setEditTitle('');
      setEditDescription('');
      toast.success('Bundle updated successfully');
    } catch (error) {
      console.error('Error updating bundle: ', error);
      toast.error('Failed to update bundle');
    }
  };

  const startEditingBundle = (bundle: Bundle) => {
    setEditingBundle(bundle.id);
    setEditTitle(bundle.title);
    setEditDescription(bundle.description || '');
  };

  const handleAddStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBundle || !storyUrl.trim() || !storyTitle.trim()) return;

    try {
      await addDoc(collection(db, 'contentItems'), {
        bundleId: activeBundle,
        sourceType: storyType,
        url: storyUrl,
        title: storyTitle,
        sourceInfo: {
          name: 'Manual Entry',
          credibility: 'medium'
        },
        priority: false,
        userAction: 'unreviewed',
        addedAt: new Date(),
        order: bundleStories[activeBundle]?.length || 0
      });

      setStoryUrl('');
      setStoryTitle('');
      setShowAddStory(false);
      toast.success('Story added successfully');
    } catch (error) {
      console.error('Error adding story: ', error);
      toast.error('Failed to add story');
    }
  };

  const loadSuggestedStories = async (bundleId: string) => {
    // Prevent rapid successive calls
    if (isLoadingSuggestions) {
      console.log('Already loading suggestions, skipping...');
      return;
    }
    
    setIsLoadingSuggestions(true);
    try {
      const suggestions = await BundleSearchService.getSuggestedStoriesForBundle(bundleId);
      setSuggestedStories(suggestions);
    } catch (error) {
      console.error('Error loading suggested stories:', error);
      toast.error('Failed to load suggested stories');
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const loadAIResults = async (bundleId: string) => {
    const bundle = bundles.find(b => b.id === bundleId);
    if (!bundle) return;

    setIsLoadingAI(true);
    setShowAIResults(true);
    try {
      const response = await fetch('/api/ai-research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bundleTitle: bundle.title,
          bundleDescription: bundle.description,
          service: 'both',
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        if (data.error?.includes('API key')) {
          toast.error('AI services not configured. Please add API keys to .env.local');
        } else {
          throw new Error(data.error || 'Failed to fetch AI results');
        }
      }

      setAiResults(data);
    } catch (error) {
      console.error('Error loading AI results:', error);
      toast.error('Failed to load AI research results');
    } finally {
      setIsLoadingAI(false);
    }
  };

  const addSuggestedStory = async (story: ContentItem) => {
    try {
      // Clean the story data to remove undefined values
      const storyData = cleanFirestoreData({
        ...story,
        priority: false,
        userAction: 'unreviewed',
        addedAt: new Date(),
        order: bundleStories[story.bundleId]?.length || 0
      });
      
      await addDoc(collection(db, 'contentItems'), storyData);
      
      toast.success('Story added to bundle');
      setSuggestedStories(suggestedStories.filter(s => s.id !== story.id));
    } catch (error) {
      console.error('Error adding suggested story:', error);
      toast.error('Failed to add story');
    }
  };

  const addAIStory = async (story: any, source: 'perplexity' | 'claude') => {
    if (!activeBundle) return;

    try {
      const contentItem = {
        bundleId: activeBundle,
        sourceType: (story.type === 'video' ? 'video' : 
                     story.type === 'tweet' ? 'tweet' : 
                     story.type === 'social' ? 'social' : 'article') as ContentItem['sourceType'],
        url: story.url || '#',
        title: story.title,
        description: story.snippet || story.summary || '',
        sourceInfo: {
          name: source === 'perplexity' ? `Perplexity: ${story.source || 'Web'}` : `Claude: ${story.perspective || 'Analysis'}`,
          credibility: story.credibility || 'medium',
        },
        priority: false,
        userAction: 'unreviewed',
        addedAt: new Date(),
        order: bundleStories[activeBundle]?.length || 0
      };

      await addDoc(collection(db, 'contentItems'), contentItem);
      
      toast.success(`Added from ${source}`);
      
      if (source === 'perplexity' && aiResults?.perplexity) {
        setAiResults({
          ...aiResults,
          perplexity: aiResults.perplexity.filter((s: any) => s.id !== story.id)
        });
      }
    } catch (error) {
      console.error('Error adding AI story:', error);
      toast.error('Failed to add story');
    }
  };

  // Get the current bundle
  const currentBundle = bundles.find(b => b.id === activeBundle);
  const currentStories = activeBundle ? (bundleStories[activeBundle] || []) : [];

  // Generate titles using AI
  const generateTitles = async () => {
    if (!currentBundle || currentStories.length === 0) {
      toast.error('Add some stories to generate titles');
      return;
    }

    setIsGeneratingTitles(true);
    try {
      const response = await fetch('/api/generate-bundle-titles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stories: currentStories,
          bundleDescription: currentBundle.description,
          customInstructions: localStorage.getItem('titleGenerationInstructions') || ''
        })
      });

      if (!response.ok) throw new Error('Failed to generate titles');
      
      const data = await response.json();
      setGeneratedTitles(data.titles);
    } catch (error) {
      console.error('Error generating titles:', error);
      toast.error('Failed to generate titles');
    } finally {
      setIsGeneratingTitles(false);
    }
  };

  // Search images for an entity
  const searchImagesForEntity = async (entity: ExtractedEntity) => {
    if (loadingImages.has(entity.id)) return;

    setLoadingImages(prev => new Set([...prev, entity.id]));
    try {
      const images = await ImageSearchService.searchImages(entity.name, {
        count: 6,
        freshness: 'Week',
        imageType: entity.type === 'person' ? 'Face' : 'Photo'
      });
      
      setEntityImages(prev => ({ ...prev, [entity.id]: images }));
    } catch (error) {
      console.error('Error searching images:', error);
      toast.error('Failed to search images');
    } finally {
      setLoadingImages(prev => {
        const next = new Set(prev);
        next.delete(entity.id);
        return next;
      });
    }
  };

  // Run Perplexity analysis
  const runPerplexityAnalysis = async (promptId: string, prompt: string) => {
    if (loadingPerplexity.has(promptId) || !currentBundle) return;

    setLoadingPerplexity(prev => new Set([...prev, promptId]));
    try {
      // Use the AI research endpoint with custom prompt
      const response = await fetch('/api/ai-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: prompt,
          bundleTitle: currentBundle.title,
          bundleDescription: currentBundle.description,
          stories: currentStories
        })
      });

      if (!response.ok) throw new Error('Failed to run analysis');
      
      const data = await response.json();
      setPerplexityResults(prev => ({ ...prev, [promptId]: data }));
    } catch (error) {
      console.error('Error running analysis:', error);
      toast.error('Failed to run analysis');
    } finally {
      setLoadingPerplexity(prev => {
        const next = new Set(prev);
        next.delete(promptId);
        return next;
      });
    }
  };

  // Toggle entity selection
  const toggleEntity = (entityId: string) => {
    const newSelected = new Set(selectedEntities);
    if (newSelected.has(entityId)) {
      newSelected.delete(entityId);
    } else {
      newSelected.add(entityId);
    }
    setSelectedEntities(newSelected);
  };

  // Remove entity
  const removeEntity = (entityId: string) => {
    setExtractedEntities(prev => prev.filter(e => e.id !== entityId));
    const newSelected = new Set(selectedEntities);
    newSelected.delete(entityId);
    setSelectedEntities(newSelected);
  };

  // Filter and sort suggested stories
  const getFilteredAndSortedStories = () => {
    let filtered = suggestedStories;

    // Filter by search query
    if (storySearchQuery) {
      filtered = filtered.filter(story => 
        story.title.toLowerCase().includes(storySearchQuery.toLowerCase()) ||
        story.description?.toLowerCase().includes(storySearchQuery.toLowerCase()) ||
        story.sourceInfo.name.toLowerCase().includes(storySearchQuery.toLowerCase())
      );
    }

    // Filter by type
    if (storyFilterBy !== 'all') {
      filtered = filtered.filter(story => story.sourceType === storyFilterBy);
    }

    // Sort stories
    return filtered.sort((a, b) => {
      switch (storySortBy) {
        case 'date':
          return new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime();
        case 'source':
          return a.sourceInfo.name.localeCompare(b.sourceInfo.name);
        case 'relevance':
        default:
          return 0; // Default order from feed
      }
    });
  };

  // Check if story is already in current bundle
  const isStoryInBundle = (storyId: string) => {
    return currentStories.some(story => story.id === storyId);
  };

  // Toggle story in/out of bundle
  const toggleStoryInBundle = async (story: ContentItem) => {
    if (isStoryInBundle(story.id)) {
      // Remove from bundle
      onDeleteStory(story.id);
    } else {
      // Add to bundle
      addSuggestedStory(story);
      // Auto-switch to selected tab when adding stories
      setActiveStoryTab('selected');
    }
  };

  // Load suggestions when bundle changes
  useEffect(() => {
    if (activeBundle && currentBundle && (currentBundle.title || currentBundle.description)) {
      loadSuggestedStories(activeBundle);
    } else {
      setSuggestedStories([]);
    }
    // Reset AI results when changing bundles
    setShowAIResults(false);
    setAiResults(null);
  }, [activeBundle, currentBundle]);

  if (isLoadingBundles) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading bundles...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-full flex flex-col">
        {/* Bundle Tabs */}
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <div className="px-8 pt-6 pb-0">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Story Bundles</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {activeProject?.name || 'Loading...'} • {bundles.length} bundles • {Object.values(bundleStories).reduce((acc, stories) => acc + stories.length, 0)} stories
                </p>
              </div>
              <button
                onClick={() => setShowAddBundle(true)}
                className="btn-primary flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                New Bundle
              </button>
            </div>
            
            {bundles.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400 mb-4">No bundles yet. Create your first bundle to get started.</p>
              </div>
            ) : (
              <nav className="flex space-x-1 overflow-x-auto pb-px">
                {bundles.map((bundle) => (
                  <button
                    key={bundle.id}
                    onClick={() => setActiveBundle(bundle.id)}
                    className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                      activeBundle === bundle.id
                        ? 'bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white border-t border-l border-r border-gray-200 dark:border-gray-800'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        bundle.priority === 'hot' ? 'bg-red-500' : 
                        bundle.priority === 'growing' ? 'bg-amber-500' : 
                        'bg-blue-500'
                      }`} />
                      {bundle.title}
                    </div>
                  </button>
                ))}
              </nav>
            )}
          </div>
        </div>

        {/* Bundle Content */}
        {currentBundle && (
          <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950">
            <div className="max-w-7xl mx-auto p-8">
              {/* Bundle Header */}
              <div className="mb-6">
                {editingBundle === currentBundle.id ? (
                  <div className="bg-white dark:bg-gray-900 rounded-xl p-6 space-y-4">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-4 py-2 text-xl font-semibold bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white"
                      placeholder="Bundle title"
                      autoFocus
                    />
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full px-4 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white resize-none"
                      placeholder="Additional guidance for finding relevant content"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateBundle(currentBundle.id)}
                        className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={() => {
                          setEditingBundle(null);
                          setEditTitle('');
                          setEditDescription('');
                        }}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-gray-900 rounded-xl p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                          {currentBundle.title}
                        </h2>
                        {currentBundle.description && (
                          <p className="text-gray-600 dark:text-gray-400 mb-3">
                            {currentBundle.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {currentBundle.estimatedTime} min
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            {currentStories.length} stories
                          </span>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            currentBundle.priority === 'hot' 
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' 
                              : currentBundle.priority === 'growing' 
                              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          }`}>
                            {currentBundle.priority}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => startEditingBundle(currentBundle)}
                          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                          title="Edit bundle"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setShowAddStory(true)}
                          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                          title="Add story"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteBundle(currentBundle.id)}
                          className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                          title="Delete bundle"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Story Selector from Feeds */}
              <div className="mb-6 bg-white dark:bg-gray-900 rounded-xl">
                {/* Tab Headers */}
                <div className="flex border-b border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setActiveStoryTab('all')}
                    className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                      activeStoryTab === 'all'
                        ? 'text-brand-600 dark:text-brand-400 border-b-2 border-brand-600 dark:border-brand-400 bg-brand-50 dark:bg-brand-900/10'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    All Stories ({getFilteredAndSortedStories().length})
                    {isLoadingSuggestions && (
                      <svg className="inline-block ml-2 animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 818-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveStoryTab('selected')}
                    className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                      activeStoryTab === 'selected'
                        ? 'text-brand-600 dark:text-brand-400 border-b-2 border-brand-600 dark:border-brand-400 bg-brand-50 dark:bg-brand-900/10'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    Selected Stories ({currentStories.length})
                  </button>
                </div>

                {/* Tab Content */}
                <div className="p-6">

                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Story Selector ({getFilteredAndSortedStories().length} available)
                  </h3>
                  {isLoadingSuggestions && (
                    <svg className="animate-spin h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                </div>

                {/* Search and Filters */}
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Search stories, sources, or keywords..."
                      value={storySearchQuery}
                      onChange={(e) => setStorySearchQuery(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
                  </div>
                  <select
                    value={storyFilterBy}
                    onChange={(e) => setStoryFilterBy(e.target.value as any)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="all">All Types</option>
                    <option value="article">Articles</option>
                    <option value="video">Videos</option>
                    <option value="tweet">Tweets</option>
                    <option value="social">Social</option>
                  </select>
                  <select
                    value={storySortBy}
                    onChange={(e) => setStorySortBy(e.target.value as any)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="relevance">By Relevance</option>
                    <option value="date">By Date</option>
                    <option value="source">By Source</option>
                  </select>
                </div>

                {/* Stories Table */}
                {suggestedStories.length === 0 && !isLoadingSuggestions ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                    </svg>
                    <p className="text-sm">No matching stories from your feeds</p>
                    <p className="text-xs mt-1">Try adjusting your search or filters</p>
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="space-y-0">
                      {getFilteredAndSortedStories().map((story, index) => {
                        const inBundle = isStoryInBundle(story.id);
                        return (
                          <div 
                            key={story.id} 
                            className={`flex items-center p-4 border-b border-gray-100 dark:border-gray-800 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                              inBundle ? 'bg-green-50 dark:bg-green-900/20' : ''
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                      story.sourceType === 'article' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                                      story.sourceType === 'video' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' :
                                      story.sourceType === 'tweet' ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300' :
                                      story.sourceType === 'social' ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300' :
                                      'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                    }`}>
                                      {story.sourceType}
                                    </span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                      {story.sourceInfo.name}
                                    </span>
                                    {story.publishedAt && (
                                      <span className="text-xs text-gray-400 dark:text-gray-500">
                                        {new Date(story.publishedAt).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1 line-clamp-1">
                                    {story.title}
                                  </h4>
                                  {story.description && (
                                    <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-1">
                                      {story.description}
                                    </p>
                                  )}
                                  <a 
                                    href={story.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {new URL(story.url).hostname}
                                  </a>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <button
                                onClick={() => toggleStoryInBundle(story)}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                  inBundle 
                                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50'
                                    : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50'
                                }`}
                                title={inBundle ? 'Remove from bundle' : 'Add to bundle'}
                              >
                                {inBundle ? (
                                  <>
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                    </svg>
                                    Remove
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                    Add
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
                </div>

              {/* AI Generated Titles Section */}
              <div className="mb-6 bg-white dark:bg-gray-900 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Title Suggestions</h3>
                  <div className="flex items-center gap-2">
                    <TitleGenerationSettings />
                    <button
                    onClick={generateTitles}
                    disabled={isGeneratingTitles}
                    className="btn-secondary text-sm flex items-center gap-2"
                  >
                    {isGeneratingTitles ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Generating...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh Titles
                      </>
                    )}
                  </button>
                  </div>
                </div>
                
                {generatedTitles.length > 0 ? (
                  <div className="grid gap-2">
                    {generatedTitles.map((title, index) => (
                      <div key={index} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors" onClick={() => navigator.clipboard.writeText(title).then(() => toast.success('Copied to clipboard'))}>
                        <p className="text-gray-900 dark:text-white font-medium">{title}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                    Click "Refresh Titles" to generate AI-powered title suggestions based on your stories
                  </p>
                )}
              </div>

              {/* Related Entities Section */}
              {extractedEntities.length > 0 && (
                <div className="mb-6 bg-white dark:bg-gray-900 rounded-xl p-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Related People, Places & Organizations</h3>
                  <div className="flex flex-wrap gap-2">
                    {extractedEntities.map((entity) => (
                      <div
                        key={entity.id}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                          selectedEntities.has(entity.id)
                            ? 'bg-brand-600 text-white'
                            : entity.type === 'person'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                            : entity.type === 'organization'
                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                            : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        } cursor-pointer hover:ring-2 hover:ring-offset-2 hover:ring-brand-500`}
                        onClick={() => {
                          toggleEntity(entity.id);
                          if (!entityImages[entity.id]) {
                            searchImagesForEntity(entity);
                          }
                        }}
                      >
                        <span>{entity.name}</span>
                        <span className="text-xs opacity-75">({entity.count})</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeEntity(entity.id);
                          }}
                          className="ml-1 hover:text-red-600"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Perplexity Analysis Section */}
              <div className="mb-6 bg-white dark:bg-gray-900 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">AI Analysis</h3>
                  <button
                    onClick={() => {
                      const newPrompt = {
                        id: Date.now().toString(),
                        title: 'Custom Analysis',
                        prompt: ''
                      };
                      setPerplexityPrompts([...perplexityPrompts, newPrompt]);
                    }}
                    className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400"
                  >
                    + Add Analysis
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {perplexityPrompts.map((prompt) => (
                    <div key={prompt.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <input
                        type="text"
                        value={prompt.title}
                        onChange={(e) => {
                          setPerplexityPrompts(prev => prev.map(p => 
                            p.id === prompt.id ? { ...p, title: e.target.value } : p
                          ));
                        }}
                        className="w-full font-medium text-gray-900 dark:text-white bg-transparent border-none outline-none mb-2"
                        placeholder="Analysis Title"
                      />
                      <textarea
                        value={prompt.prompt}
                        onChange={(e) => {
                          setPerplexityPrompts(prev => prev.map(p => 
                            p.id === prompt.id ? { ...p, prompt: e.target.value } : p
                          ));
                        }}
                        className="w-full text-sm text-gray-600 dark:text-gray-400 bg-transparent border-none outline-none resize-none mb-3"
                        placeholder="Enter your analysis prompt..."
                        rows={2}
                      />
                      
                      {perplexityResults[prompt.id] ? (
                        <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2 max-h-48 overflow-y-auto">
                          {perplexityResults[prompt.id].perplexity?.result && (
                            <p>{perplexityResults[prompt.id].perplexity.result}</p>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => runPerplexityAnalysis(prompt.id, prompt.prompt)}
                          disabled={loadingPerplexity.has(prompt.id) || !prompt.prompt}
                          className="w-full btn-secondary text-sm"
                        >
                          {loadingPerplexity.has(prompt.id) ? (
                            <span className="flex items-center justify-center gap-2">
                              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Analyzing...
                            </span>
                          ) : (
                            'Run Analysis'
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Research */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    AI Research
                  </h3>
                  {!showAIResults && (
                    <button
                      onClick={() => loadAIResults(activeBundle)}
                      className="text-xs px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                    >
                      Search with AI
                      </button>
                    )}
                  </div>

                  {showAIResults ? (
                    <div className="space-y-4">
                      {isLoadingAI ? (
                        <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                          <div className="flex items-center gap-3">
                            <svg className="animate-spin h-5 w-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <p className="text-sm text-purple-700 dark:text-purple-300">
                              AI is searching for diverse perspectives and sources...
                            </p>
                          </div>
                        </div>
                      ) : aiResults ? (
                        <>
                          {/* AI Search Results */}
                          {aiResults.perplexity && aiResults.perplexity.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400">Perplexity Results</h4>
                              {aiResults.perplexity.slice(0, 3).map((result: any, index: number) => (
                                <div key={result.id} className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-800">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <h5 className="text-sm font-medium text-gray-900 dark:text-white">{result.title}</h5>
                                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{result.snippet}</p>
                                      {result.url && (
                                        <a 
                                          href={result.url} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mt-1 inline-block"
                                        >
                                          {new URL(result.url).hostname}
                                        </a>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => addAIStory(result, 'perplexity')}
                                      className="p-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-all ml-2"
                                      title="Add to bundle"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {aiResults?.claude?.suggested_sources && aiResults.claude.suggested_sources.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400">Claude Suggestions</h4>
                              {aiResults.claude.suggested_sources.slice(0, 3).map((source: any, index: number) => (
                                <div key={source.id} className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-800">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <h5 className="text-sm font-medium text-gray-900 dark:text-white">{source.title}</h5>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                                          source.perspective === 'conservative' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                                          source.perspective === 'liberal' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                                          'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                                        }`}>
                                          {source.perspective}
                                        </span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                          {source.credibility} credibility
                                        </span>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => addAIStory(source, 'claude')}
                                      className="p-1.5 text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded transition-all ml-2"
                                      title="Add to bundle"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            Click "Search with AI" to find diverse perspectives and sources using Perplexity and Claude.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        Click "Search with AI" to find diverse perspectives and sources using Perplexity and Claude.
                      </p>
                    </div>
                  )}
                </div>

              {/* Entity Images Section */}
              {extractedEntities.length > 0 && (
                <div className="mt-6 bg-white dark:bg-gray-900 rounded-xl p-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Image Suggestions</h3>
                  {selectedEntities.size === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Click on entities above to search for images</p>
                  ) : (
                    <div className="space-y-6">
                      {Array.from(selectedEntities).map(entityId => {
                        const entity = extractedEntities.find(e => e.id === entityId);
                        if (!entity) return null;
                        
                        const images = entityImages[entityId] || [];
                        const isLoading = loadingImages.has(entityId);
                        
                        return (
                          <div key={entityId}>
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                              {entity.name}
                              {isLoading && (
                                <span className="ml-2">
                                  <svg className="inline-block animate-spin h-3 w-3 text-gray-500" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                </span>
                              )}
                            </h4>
                            {images.length > 0 ? (
                              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                                {images.map((image, index) => (
                                  <div key={index} className="relative group">
                                    <img
                                      src={image.thumbnailUrl}
                                      alt={image.title}
                                      className="w-full h-24 object-cover rounded-lg hover:ring-2 hover:ring-brand-500 cursor-pointer"
                                      onClick={() => window.open(image.url, '_blank')}
                                    />
                                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity rounded-lg flex items-center justify-center">
                                      <a
                                        href={image.url}
                                        download
                                        className="opacity-0 group-hover:opacity-100 p-2 bg-white rounded-full text-gray-900"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                      </a>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : !isLoading ? (
                              <p className="text-xs text-gray-500 dark:text-gray-400">No images found</p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Bundle Modal */}
      {showAddBundle && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAddBundle(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-lg w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Create New Bundle</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Organize related stories together</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddBundle(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateBundle}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Bundle Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Breaking: Supreme Court Decision"
                    value={bundleTitle}
                    onChange={(e) => setBundleTitle(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent text-gray-900 dark:text-white"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Content Guidance (Optional)
                  </label>
                  <textarea
                    placeholder="e.g., Focus on recent supreme court rulings related to injunctions"
                    value={bundleDescription}
                    onChange={(e) => setBundleDescription(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent resize-none text-gray-900 dark:text-white"
                    rows={3}
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddBundle(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  Create Bundle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Story Modal */}
      {showAddStory && activeBundle && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAddStory(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-lg w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Add Story</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  To: {currentBundle?.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddStory(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleAddStory}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Story Type
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['article', 'video', 'tweet'] as const).map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setStoryType(type)}
                        className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                          storyType === type
                            ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Story Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Court Rules 5-4 on Major Case"
                    value={storyTitle}
                    onChange={(e) => setStoryTitle(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent text-gray-900 dark:text-white"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Story URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://example.com/article"
                    value={storyUrl}
                    onChange={(e) => setStoryUrl(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent text-gray-900 dark:text-white"
                    required
                  />
                </div>
              </div>
              
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddStory(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  Add Story
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}