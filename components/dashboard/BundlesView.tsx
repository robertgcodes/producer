'use client';

import { useState, useEffect } from 'react';
import { Bundle, ContentItem } from '@/types';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { IconButton } from '@/components/ui/IconButton';
import { ArticleIcon, VideoIcon, TweetIcon, SocialIcon, PollIcon } from '@/components/icons';
import { toast } from 'sonner';
import { BundleSearchService } from '@/lib/services/bundleSearchService';

interface BundlesViewProps {
  activeProject: any;
  bundles: Bundle[];
  bundleStories: Record<string, ContentItem[]>;
  isLoadingBundles: boolean;
  onDeleteStory: (storyId: string) => void;
}

export function BundlesView({ 
  activeProject, 
  bundles, 
  bundleStories, 
  isLoadingBundles,
  onDeleteStory 
}: BundlesViewProps) {
  const [showAddBundle, setShowAddBundle] = useState(false);
  const [showAddStory, setShowAddStory] = useState(false);
  const [showBundleDetail, setShowBundleDetail] = useState(false);
  const [selectedBundle, setSelectedBundle] = useState<string | null>(null);
  const [bundleTitle, setBundleTitle] = useState('');
  const [bundleDescription, setBundleDescription] = useState('');
  const [storyUrl, setStoryUrl] = useState('');
  const [storyTitle, setStoryTitle] = useState('');
  const [storyType, setStoryType] = useState<ContentItem['sourceType']>('article');
  const [editingBundle, setEditingBundle] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [suggestedStories, setSuggestedStories] = useState<ContentItem[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [aiResults, setAiResults] = useState<any>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [showAIResults, setShowAIResults] = useState(false);

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
      
      await addDoc(collection(db, 'bundles'), bundleData);
      setBundleTitle('');
      setBundleDescription('');
      setShowAddBundle(false);
      toast.success('Bundle created successfully');
    } catch (error: any) {
      console.error('Error creating bundle: ', error);
      toast.error(`Failed to create bundle: ${error.message}`);
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
    if (!selectedBundle || !storyUrl.trim() || !storyTitle.trim()) return;

    try {
      await addDoc(collection(db, 'contentItems'), {
        bundleId: selectedBundle,
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
        order: 0
      });

      setStoryUrl('');
      setStoryTitle('');
      setShowAddStory(false);
      setSelectedBundle(null);
    } catch (error) {
      console.error('Error adding story: ', error);
    }
  };

  const loadSuggestedStories = async (bundleId: string) => {
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

  const handleOpenBundleDetail = (bundle: Bundle) => {
    setSelectedBundle(bundle.id);
    setShowBundleDetail(true);
    setSuggestedStories([]); // Clear previous suggestions
    if (bundle.title || bundle.description) {
      loadSuggestedStories(bundle.id);
    }
  };

  const addSuggestedStory = async (story: ContentItem) => {
    try {
      await addDoc(collection(db, 'contentItems'), {
        bundleId: story.bundleId,
        sourceType: story.sourceType,
        url: story.url,
        title: story.title,
        description: story.description,
        sourceInfo: story.sourceInfo,
        priority: false,
        userAction: 'unreviewed',
        addedAt: new Date(),
        order: bundleStories[story.bundleId]?.length || 0
      });
      
      toast.success('Story added to bundle');
      // Remove from suggestions
      setSuggestedStories(suggestedStories.filter(s => s.id !== story.id));
    } catch (error) {
      console.error('Error adding suggested story:', error);
      toast.error('Failed to add story');
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

  const addAIStory = async (story: any, source: 'perplexity' | 'claude') => {
    if (!selectedBundle) return;

    try {
      const contentItem = {
        bundleId: selectedBundle,
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
        order: bundleStories[selectedBundle]?.length || 0
      };

      await addDoc(collection(db, 'contentItems'), contentItem);
      
      toast.success(`Added from ${source}`);
      
      // Remove from AI results if possible
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

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Story Bundles</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Organize your news stories into powerful segments</p>
      </div>

      {/* Bundles Grid */}
      {isLoadingBundles ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-900 rounded-xl p-6 animate-pulse">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
              <div className="space-y-2 mb-4">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
              </div>
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          ))}
        </div>
      ) : bundles.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No bundles yet</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
            Create your first bundle to start organizing stories for your show
          </p>
          <button
            onClick={() => setShowAddBundle(true)}
            className="btn-primary mx-auto"
          >
            Create First Bundle
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {bundles.map((bundle, index) => (
            <div 
              key={bundle.id} 
              className="bg-white dark:bg-gray-900 rounded-xl p-6 hover:shadow-lg transition-all duration-200"
            >
              {/* Bundle Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  {editingBundle === bundle.id ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full px-3 py-1.5 text-lg font-medium bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white"
                        placeholder="Story title"
                        autoFocus
                      />
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white resize-none"
                        placeholder="Additional guidance for finding relevant content (e.g., focus on supreme court rulings related to injunctions)"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateBundle(bundle.id)}
                          className="px-3 py-1 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingBundle(null);
                            setEditTitle('');
                            setEditDescription('');
                          }}
                          className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="group cursor-pointer" onClick={() => startEditingBundle(bundle)}>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors flex items-center gap-2">
                          {bundle.title}
                          <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </h3>
                        {bundle.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                            {bundle.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {bundle.estimatedTime} min
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          {bundleStories[bundle.id]?.length || 0} stories
                        </span>
                      </div>
                    </>
                  )}
                </div>
                {editingBundle !== bundle.id && (
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    bundle.priority === 'hot' 
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' 
                      : bundle.priority === 'growing' 
                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  }`}>
                    {bundle.priority}
                  </span>
                )}
              </div>

              {/* Stories Preview */}
              {bundleStories[bundle.id] && bundleStories[bundle.id].length > 0 && (
                <div className="mb-4 space-y-2">
                  {bundleStories[bundle.id].slice(0, 3).map((story, idx) => (
                    <div key={story.id} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <span className="text-gray-400 dark:text-gray-600">{idx + 1}.</span>
                      <span className="truncate">{story.title}</span>
                    </div>
                  ))}
                  {bundleStories[bundle.id].length > 3 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">+{bundleStories[bundle.id].length - 3} more</p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => handleOpenBundleDetail(bundle)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Manage Stories
                </button>
                <button
                  onClick={() => {
                    setSelectedBundle(bundle.id);
                    setShowAddStory(true);
                  }}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  title="Quick add story"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent"
                    required
                    autoFocus
                  />
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Give your bundle a descriptive title that captures the main story
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Content Guidance (Optional)
                  </label>
                  <textarea
                    placeholder="e.g., Focus on recent supreme court rulings related to injunctions, especially dissenting opinions"
                    value={bundleDescription}
                    onChange={(e) => setBundleDescription(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent resize-none"
                    rows={3}
                  />
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Provide additional context to help find the most relevant content from your feeds
                  </p>
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
      {showAddStory && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setShowAddStory(false); setSelectedBundle(null); }}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-lg w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Add Story</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  To: {bundles.find(b => b.id === selectedBundle)?.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setShowAddStory(false); setSelectedBundle(null); }}
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
                    <IconButton
                      icon={<ArticleIcon />}
                      label="Article"
                      selected={storyType === 'article'}
                      onClick={() => setStoryType('article')}
                    />
                    <IconButton
                      icon={<VideoIcon />}
                      label="Video"
                      selected={storyType === 'video'}
                      onClick={() => setStoryType('video')}
                    />
                    <IconButton
                      icon={<TweetIcon />}
                      label="Tweet"
                      selected={storyType === 'tweet'}
                      onClick={() => setStoryType('tweet')}
                    />
                    <IconButton
                      icon={<SocialIcon />}
                      label="Social"
                      selected={storyType === 'social'}
                      onClick={() => setStoryType('social')}
                    />
                    <IconButton
                      icon={<PollIcon />}
                      label="Poll"
                      selected={storyType === 'poll'}
                      onClick={() => setStoryType('poll')}
                    />
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
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent"
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
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent"
                    required
                  />
                </div>
              </div>
              
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddStory(false);
                    setSelectedBundle(null);
                  }}
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

      {/* Bundle Detail Modal */}
      {showBundleDetail && selectedBundle && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setShowBundleDetail(false); setSelectedBundle(null); }}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {bundles.find(b => b.id === selectedBundle)?.title}
                </h3>
                {bundles.find(b => b.id === selectedBundle)?.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {bundles.find(b => b.id === selectedBundle)?.description}
                  </p>
                )}
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {bundleStories[selectedBundle]?.length || 0} stories • {bundles.find(b => b.id === selectedBundle)?.estimatedTime} min
                </p>
              </div>
              <button
                type="button"
                onClick={() => { 
                  setShowBundleDetail(false); 
                  setSelectedBundle(null); 
                  setShowAIResults(false);
                  setAiResults(null);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-6">
              {/* Current Stories Section */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 sticky top-0 bg-white dark:bg-gray-900 pb-2">
                  Current Stories ({bundleStories[selectedBundle]?.length || 0})
                </h4>
                {(!bundleStories[selectedBundle] || bundleStories[selectedBundle].length === 0) ? (
                  <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <svg className="w-10 h-10 mx-auto text-gray-400 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-gray-500 dark:text-gray-400 mb-3 text-sm">No stories in this bundle yet</p>
                    <button
                      onClick={() => {
                        setShowBundleDetail(false);
                        setShowAddStory(true);
                      }}
                      className="btn-primary text-sm"
                    >
                      Add First Story
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {bundleStories[selectedBundle].map((story, index) => (
                      <div key={story.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                                {index + 1}.
                              </span>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                story.sourceType === 'article' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                                story.sourceType === 'video' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' :
                                story.sourceType === 'tweet' ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300' :
                                story.sourceType === 'social' ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300' :
                                'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                              }`}>
                                {story.sourceType === 'article' && <ArticleIcon className="w-3 h-3" />}
                                {story.sourceType === 'video' && <VideoIcon className="w-3 h-3" />}
                                {story.sourceType === 'tweet' && <TweetIcon className="w-3 h-3" />}
                                {story.sourceType === 'social' && <SocialIcon className="w-3 h-3" />}
                                {story.sourceType === 'poll' && <PollIcon className="w-3 h-3" />}
                                {story.sourceType}
                              </span>
                            </div>
                            <h4 className="font-medium text-gray-900 dark:text-white mb-1">{story.title}</h4>
                            <a 
                              href={story.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                            >
                              {new URL(story.url).hostname}
                            </a>
                          </div>
                          <button
                            onClick={() => onDeleteStory(story.id)}
                            className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                            title="Delete story"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Suggested Stories Section */}
              {(suggestedStories.length > 0 || isLoadingSuggestions) && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 sticky top-0 bg-white dark:bg-gray-900 pb-2 flex items-center gap-2">
                    Suggested Stories from Your Feeds
                    {isLoadingSuggestions && (
                      <svg className="animate-spin h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                  </h4>
                  {isLoadingSuggestions ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 animate-pulse">
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {suggestedStories.map((story) => (
                        <div key={story.id} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                  story.sourceType === 'article' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                                  story.sourceType === 'video' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' :
                                  story.sourceType === 'tweet' ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300' :
                                  story.sourceType === 'social' ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300' :
                                  'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                }`}>
                                  {story.sourceType === 'article' && <ArticleIcon className="w-3 h-3" />}
                                  {story.sourceType === 'video' && <VideoIcon className="w-3 h-3" />}
                                  {story.sourceType === 'tweet' && <TweetIcon className="w-3 h-3" />}
                                  {story.sourceType === 'social' && <SocialIcon className="w-3 h-3" />}
                                  {story.sourceType === 'poll' && <PollIcon className="w-3 h-3" />}
                                  {story.sourceType}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  from {story.sourceInfo.name}
                                </span>
                              </div>
                              <h4 className="font-medium text-gray-900 dark:text-white mb-1">{story.title}</h4>
                              {story.description && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                                  {story.description}
                                </p>
                              )}
                              <a 
                                href={story.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                              >
                                {new URL(story.url).hostname}
                              </a>
                            </div>
                            <button
                              onClick={() => addSuggestedStory(story)}
                              className="p-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-all"
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
                </div>
              )}
              
              {/* AI Research Section */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 sticky top-0 bg-white dark:bg-gray-900 pb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    AI-Powered Research
                    <span className="text-xs text-gray-500 dark:text-gray-400">(Perplexity & Claude)</span>
                  </span>
                  {!showAIResults && (
                    <button
                      onClick={() => loadAIResults(selectedBundle)}
                      className="text-xs px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                    >
                      Search with AI
                    </button>
                  )}
                </h4>

                {showAIResults ? (
                  <div className="space-y-4">
                    {isLoadingAI ? (
                      <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                        <div className="flex items-center gap-3">
                          <svg className="animate-spin h-5 w-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span className="text-sm text-gray-700 dark:text-gray-300">Searching with AI...</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Claude Analysis */}
                        {aiResults?.claude && (
                          <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
                            <h5 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                              <svg className="w-4 h-4 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                              Claude Analysis
                            </h5>
                            
                            {aiResults.claude.summary && (
                              <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">{aiResults.claude.summary}</p>
                            )}
                            
                            {aiResults.claude.perspectives?.length > 0 && (
                              <div className="mb-3">
                                <h6 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Different Perspectives:</h6>
                                <div className="space-y-1">
                                  {aiResults.claude.perspectives.map((perspective: any, idx: number) => (
                                    <div key={idx} className="text-xs bg-white/50 dark:bg-gray-900/50 rounded p-2">
                                      <span className="font-medium text-gray-700 dark:text-gray-300">{perspective.side}:</span>
                                      <span className="text-gray-600 dark:text-gray-400 ml-1">{perspective.argument}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {aiResults.claude.suggested_sources?.length > 0 && (
                              <div>
                                <h6 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Suggested Sources:</h6>
                                <div className="space-y-2">
                                  {aiResults.claude.suggested_sources.slice(0, 5).map((source: any) => (
                                    <div key={source.id} className="bg-white/50 dark:bg-gray-900/50 rounded p-3">
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <h6 className="text-sm font-medium text-gray-900 dark:text-white">{source.title}</h6>
                                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{source.summary}</p>
                                          <div className="flex items-center gap-2 mt-1">
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                                              source.perspective === 'conservative' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                                              source.perspective === 'liberal' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                                              source.perspective === 'official' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                                              'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                                            }`}>
                                              {source.perspective}
                                            </span>
                                            <span className={`text-xs ${
                                              source.credibility === 'high' ? 'text-green-600 dark:text-green-400' :
                                              source.credibility === 'low' ? 'text-red-600 dark:text-red-400' :
                                              'text-yellow-600 dark:text-yellow-400'
                                            }`}>
                                              {source.credibility} credibility
                                            </span>
                                          </div>
                                        </div>
                                        <button
                                          onClick={() => addAIStory(source, 'claude')}
                                          className="p-2 text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded-lg transition-all"
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
                              </div>
                            )}
                          </div>
                        )}

                        {/* Perplexity Results */}
                        {aiResults?.perplexity && aiResults.perplexity.length > 0 && (
                          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                            <h5 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                              <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                              Perplexity Web Search
                            </h5>
                            <div className="space-y-2">
                              {aiResults.perplexity.map((result: any) => (
                                <div key={result.id} className="bg-white/50 dark:bg-gray-900/50 rounded p-3">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <h6 className="text-sm font-medium text-gray-900 dark:text-white">{result.title}</h6>
                                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{result.snippet}</p>
                                      {result.url && (
                                        <a 
                                          href={result.url} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block"
                                        >
                                          {result.source}
                                        </a>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => addAIStory(result, 'perplexity')}
                                      className="p-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-all"
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
                          </div>
                        )}

                        {/* Errors */}
                        {aiResults?.errors?.length > 0 && (
                          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
                            <h5 className="font-medium text-red-900 dark:text-red-100 mb-2">Some services unavailable:</h5>
                            <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                              {aiResults.errors.map((error: any, idx: number) => (
                                <li key={idx}>• {error.service}: {error.error}</li>
                              ))}
                            </ul>
                            <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                              Add API keys to .env.local to enable these services.
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                        <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h5 className="font-medium text-gray-900 dark:text-white mb-1">AI-Powered Research</h5>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Search across the web with Perplexity and get analysis from Claude to find diverse perspectives, official statements, and rich media content.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowBundleDetail(false);
                  setShowAddStory(true);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                Add More Stories
              </button>
              <button
                onClick={() => { setShowBundleDetail(false); setSelectedBundle(null); }}
                className="btn-primary"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}