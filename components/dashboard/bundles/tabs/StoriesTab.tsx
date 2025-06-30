'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Bundle, ContentItem } from '@/types';
import { BundleSearchService } from '@/lib/services/bundleSearchService';
import { toast } from 'sonner';
import { RemovedStoriesService } from '@/lib/services/removedStoriesService';

interface StoriesTabProps {
  bundle: Bundle;
  stories: ContentItem[];
  onAddStory: (story: ContentItem) => void;
  onRemoveStory: (storyId: string) => void;
}

export function StoriesTab({ bundle, stories, onAddStory, onRemoveStory }: StoriesTabProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'selected'>('all');
  const [suggestedStories, setSuggestedStories] = useState<ContentItem[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBy, setFilterBy] = useState<'all' | 'article' | 'video' | 'tweet' | 'social'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'relevance' | 'source'>('date');
  const [togglePending, setTogglePending] = useState<Set<string>>(new Set());
  const [displayCount, setDisplayCount] = useState(20);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Helper to safely parse and format dates
  const formatDate = (dateValue: any, showTime: boolean = true) => {
    if (!dateValue) return null;
    
    let date: Date;
    
    // Handle Firestore Timestamp objects
    if (dateValue?.toDate && typeof dateValue.toDate === 'function') {
      date = dateValue.toDate();
    } else if (dateValue instanceof Date) {
      date = dateValue;
    } else if (typeof dateValue === 'string' || typeof dateValue === 'number') {
      date = new Date(dateValue);
    } else {
      return null;
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return null;
    }
    
    const now = new Date();
    const dateStr = date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
    
    if (showTime) {
      const timeStr = date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit' 
      });
      return `${dateStr} at ${timeStr}`;
    }
    
    return dateStr;
  };

  // Check for cached stories but don't fetch new ones
  useEffect(() => {
    // Clear local state when bundle changes
    setSearchQuery('');
    setFilterBy('all');
    setSortBy('date');
    setDisplayCount(20);
    
    // Try to load from cache only - don't trigger fresh fetch
    const loadCachedStories = async () => {
      const cacheKey = `suggestions-${bundle.id}`;
      const cached = await BundleSearchService.getCachedStories(bundle.id);
      if (cached) {
        setSuggestedStories(cached);
      } else {
        setSuggestedStories([]);
      }
    };
    
    loadCachedStories();
  }, [bundle.id]);

  // Create a separate function for manual refresh that only pulls from indexed feeds
  const refreshStories = useCallback(async () => {
    if (isLoadingSuggestions) return;
    
    setIsLoadingSuggestions(true);
    try {
      // Refresh stories from the indexed feed items (doesn't refresh feeds themselves)
      const stories = await BundleSearchService.refreshBundleStoriesFromIndex(bundle.id);
      setSuggestedStories(stories);
      toast.success('Stories refreshed');
    } catch (error) {
      console.error('Error loading suggestions:', error);
      toast.error('Failed to load story suggestions');
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [bundle.id]);

  // Group stories by date
  const groupStoriesByDate = (storiesToGroup: ContentItem[]) => {
    const groups = new Map<string, ContentItem[]>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    storiesToGroup.forEach(story => {
      // Get valid story date
      let storyDate: Date | null = null;
      
      if (story.publishedAt) {
        const pubDate = story.publishedAt instanceof Date ? story.publishedAt : new Date(story.publishedAt);
        if (!isNaN(pubDate.getTime())) {
          storyDate = pubDate;
        }
      }
      
      if (!storyDate && story.addedAt) {
        const addDate = story.addedAt instanceof Date ? story.addedAt : new Date(story.addedAt);
        if (!isNaN(addDate.getTime())) {
          storyDate = addDate;
        }
      }
      
      // Default to today if no valid date
      if (!storyDate) {
        storyDate = new Date();
      }
      
      storyDate.setHours(0, 0, 0, 0);
      
      let dateKey: string;
      if (storyDate.getTime() === today.getTime()) {
        dateKey = 'Today';
      } else if (storyDate.getTime() === yesterday.getTime()) {
        dateKey = 'Yesterday';
      } else {
        dateKey = storyDate.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      }
      
      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push(story);
    });

    return Array.from(groups.entries()).sort((a, b) => {
      // Sort date groups in reverse chronological order
      const dateA = a[0] === 'Today' ? new Date() : a[0] === 'Yesterday' ? new Date(Date.now() - 86400000) : new Date(a[0]);
      const dateB = b[0] === 'Today' ? new Date() : b[0] === 'Yesterday' ? new Date(Date.now() - 86400000) : new Date(b[0]);
      return dateB.getTime() - dateA.getTime();
    });
  };

  // Filter and sort stories
  const filteredAndSortedStories = useMemo(() => {
    // Reset display count when filters change
    setDisplayCount(20);
    
    let storiesToShow = activeTab === 'all' ? suggestedStories : stories;
    
    // Apply search filter
    if (searchQuery) {
      storiesToShow = storiesToShow.filter(story => 
        story.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        story.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        story.sourceInfo.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply type filter
    if (filterBy !== 'all') {
      storiesToShow = storiesToShow.filter(story => story.sourceType === filterBy);
    }

    // Apply sorting
    const sorted = [...storiesToShow].sort((a, b) => {
      switch (sortBy) {
        case 'date':
          // Get valid dates for sorting
          const getValidDate = (story: ContentItem): Date => {
            // Try publishedAt first
            if (story.publishedAt) {
              const pubDate = story.publishedAt instanceof Date ? story.publishedAt : new Date(story.publishedAt);
              if (!isNaN(pubDate.getTime())) return pubDate;
            }
            // Fall back to addedAt
            if (story.addedAt) {
              const addDate = story.addedAt instanceof Date ? story.addedAt : new Date(story.addedAt);
              if (!isNaN(addDate.getTime())) return addDate;
            }
            // Default to current date if no valid date
            return new Date();
          };
          
          const dateA = getValidDate(a);
          const dateB = getValidDate(b);
          return dateB.getTime() - dateA.getTime();
        case 'source':
          return a.sourceInfo.name.localeCompare(b.sourceInfo.name);
        case 'relevance':
        default:
          return 0;
      }
    });

    return sorted;
  }, [activeTab, suggestedStories, stories, searchQuery, filterBy, sortBy]);

  // Group stories by date with pagination
  const groupedStories = useMemo(() => {
    const storiesToShow = filteredAndSortedStories.slice(0, displayCount);
    return groupStoriesByDate(storiesToShow);
  }, [filteredAndSortedStories, displayCount]);

  // Handle scroll for infinite loading
  useEffect(() => {
    const handleScroll = () => {
      if (!scrollContainerRef.current || isLoadingMore) return;
      
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;
      
      // Load more when user scrolls to 80% of content
      if (scrollPercentage > 0.8 && displayCount < filteredAndSortedStories.length) {
        setIsLoadingMore(true);
        setTimeout(() => {
          setDisplayCount(prev => Math.min(prev + 20, filteredAndSortedStories.length));
          setIsLoadingMore(false);
        }, 300);
      }
    };

    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [displayCount, filteredAndSortedStories.length, isLoadingMore]);

  const isStorySelected = useCallback((storyId: string) => {
    return stories.some(s => s.id === storyId);
  }, [stories]);

  const toggleStory = async (story: ContentItem) => {
    // Prevent multiple toggles for the same story
    if (togglePending.has(story.id)) {
      console.log('Toggle already pending for story:', story.id);
      return;
    }
    
    console.log('Toggling story:', story.id, 'Selected:', isStorySelected(story.id));
    setTogglePending(prev => new Set([...prev, story.id]));
    
    try {
      if (isStorySelected(story.id)) {
        console.log('Removing story:', story.id);
        await onRemoveStory(story.id);
        toast.success('Story removed');
        // If we're on the selected tab and removing the last story, switch to all
        if (activeTab === 'selected' && stories.length === 1) {
          setActiveTab('all');
        }
      } else {
        console.log('Adding story:', story);
        await onAddStory(story);
        // Don't auto-switch tabs - let user control navigation
        toast.success('Story added');
      }
    } catch (error) {
      console.error('Error toggling story:', error);
      toast.error('Failed to toggle story');
    } finally {
      setTogglePending(prev => {
        const next = new Set(prev);
        next.delete(story.id);
        return next;
      });
    }
  };

  const openAllStories = () => {
    const urls = filteredAndSortedStories.map(s => s.url);
    if (urls.length === 0) return;
    
    // Open first URL immediately
    window.open(urls[0], '_blank');
    
    // Open remaining URLs with delay
    urls.slice(1).forEach((url, index) => {
      setTimeout(() => {
        window.open(url, '_blank');
      }, (index + 1) * 100);
    });
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {/* Header with tabs */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <div className="px-6 pt-4">
          {/* Tab buttons */}
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'all'
                  ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              All Stories ({suggestedStories.length})
            </button>
            <button
              onClick={() => setActiveTab('selected')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'selected'
                  ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Selected ({stories.length})
            </button>
            
            {activeTab === 'all' && (
              <button
                onClick={refreshStories}
                disabled={isLoadingSuggestions}
                className="ml-auto text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
              >
                {isLoadingSuggestions ? (
                  <div className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-xs">Searching feeds...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Refresh from feeds</span>
                  </div>
                )}
              </button>
            )}
          </div>

          {/* Search and filters */}
          <div className="flex items-center gap-4 pb-4">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search stories..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400"
              />
              <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value as any)}
              className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400"
            >
              <option value="all">All Types</option>
              <option value="article">Articles</option>
              <option value="video">Videos</option>
              <option value="tweet">Tweets</option>
              <option value="social">Social</option>
            </select>
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400"
            >
              <option value="date">Sort by Date</option>
              <option value="relevance">Sort by Relevance</option>
              <option value="source">Sort by Source</option>
            </select>

            {filteredAndSortedStories.length > 0 && (
              <button
                onClick={openAllStories}
                className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title="Open all stories in new tabs"
              >
                Open All ({filteredAndSortedStories.length})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stories list with date groups */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6">
        {groupedStories.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400">
              {activeTab === 'all' 
                ? 'No stories found. Try refreshing or adjusting filters.'
                : 'No stories selected yet. Switch to "All Stories" to add some.'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedStories.map(([dateGroup, dateStories]) => (
              <div key={dateGroup}>
                {/* Date header */}
                <div className="flex items-center gap-4 mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{dateGroup}</h3>
                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800"></div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{dateStories.length} stories</span>
                </div>
                
                {/* Stories in this date group */}
                <div className="space-y-2">
                  {dateStories.map((story) => {
                    const isSelected = isStorySelected(story.id);
                    const isPending = togglePending.has(story.id);
                    
                    return (
                      <div 
                        key={story.id} 
                        className="bg-white dark:bg-gray-900 rounded-lg shadow-sm hover:shadow-md transition-shadow p-4"
                      >
                        <div className="flex gap-4">
                          {/* Left column: Thumbnail/Icon + Toggle */}
                          <div className="flex flex-col items-center gap-2 flex-shrink-0">
                            {/* Thumbnail or Type Icon */}
                            {story.thumbnail ? (
                              <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                                <img 
                                  src={story.thumbnail} 
                                  alt="" 
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    // Replace with type icon on error
                                    const parent = (e.target as HTMLImageElement).parentElement;
                                    if (parent) {
                                      parent.innerHTML = `
                                        <div class="w-full h-full flex items-center justify-center ${
                                          story.sourceType === 'article' ? 'bg-blue-100 dark:bg-blue-900/30' :
                                          story.sourceType === 'video' ? 'bg-purple-100 dark:bg-purple-900/30' :
                                          story.sourceType === 'tweet' ? 'bg-cyan-100 dark:bg-cyan-900/30' :
                                          'bg-gray-100 dark:bg-gray-800'
                                        }">
                                          ${
                                            story.sourceType === 'article' ? 
                                            '<svg class="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>' :
                                            story.sourceType === 'video' ?
                                            '<svg class="w-8 h-8 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>' :
                                            story.sourceType === 'tweet' ?
                                            '<svg class="w-8 h-8 text-cyan-600 dark:text-cyan-400" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></svg>' :
                                            '<svg class="w-8 h-8 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-6a2 2 0 01-2-2V6a2 2 0 012-2h6m0 0a2 2 0 012 2v6m0 0a2 2 0 01-2 2m2-2v4a2 2 0 01-2 2H9a2 2 0 01-2-2v-4m6 0h6a2 2 0 012 2v4a2 2 0 01-2 2h-6a2 2 0 01-2-2v-4a2 2 0 012-2z"></path></svg>'
                                          }
                                        </div>
                                      `;
                                    }
                                  }}
                                />
                              </div>
                            ) : (
                              <div className={`w-20 h-20 rounded-lg flex items-center justify-center ${
                                story.sourceType === 'article' ? 'bg-blue-100 dark:bg-blue-900/30' :
                                story.sourceType === 'video' ? 'bg-purple-100 dark:bg-purple-900/30' :
                                story.sourceType === 'tweet' ? 'bg-cyan-100 dark:bg-cyan-900/30' :
                                'bg-gray-100 dark:bg-gray-800'
                              }`}>
                                {story.sourceType === 'article' ? (
                                  <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                ) : story.sourceType === 'video' ? (
                                  <svg className="w-8 h-8 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                ) : story.sourceType === 'tweet' ? (
                                  <svg className="w-8 h-8 text-cyan-600 dark:text-cyan-400" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                                  </svg>
                                ) : (
                                  <svg className="w-8 h-8 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-6a2 2 0 01-2-2V6a2 2 0 012-2h6m0 0a2 2 0 012 2v6m0 0a2 2 0 01-2 2m2-2v4a2 2 0 01-2 2H9a2 2 0 01-2-2v-4m6 0h6a2 2 0 012 2v4a2 2 0 01-2 2h-6a2 2 0 01-2-2v-4a2 2 0 012-2z" />
                                  </svg>
                                )}
                              </div>
                            )}
                            
                            {/* Toggle underneath thumbnail */}
                            <label className={`relative inline-flex items-center ${isPending ? 'cursor-wait opacity-50' : 'cursor-pointer'}`}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleStory(story)}
                                disabled={isPending}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 dark:peer-focus:ring-brand-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand-600"></div>
                            </label>
                          </div>
                          
                          {/* Right column: Story content */}
                          <div className="flex-1 min-w-0 relative">
                          {/* X button for removal */}
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (activeTab === 'selected') {
                                // Remove from bundle (existing functionality)
                                onRemoveStory(story.id);
                              } else {
                                // Remove from suggestions (mark as removed without adding to bundle)
                                try {
                                  await RemovedStoriesService.markAsRemoved(
                                    story.id,
                                    bundle.id,
                                    bundle.userId,
                                    story.url
                                  );
                                  // Remove from local state
                                  setSuggestedStories(prev => prev.filter(s => s.id !== story.id));
                                  toast.success('Story removed from suggestions');
                                } catch (error) {
                                  console.error('Error removing story from suggestions:', error);
                                  toast.error('Failed to remove story');
                                }
                              }
                            }}
                            className="absolute -top-2 -right-2 p-1 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-full transition-colors"
                            title={activeTab === 'selected' ? "Remove from bundle" : "Remove from suggestions"}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                          
                          {/* Metadata row */}
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                              {story.sourceInfo.name}
                              {story.sourceInfo.credibility && (
                                <span className={`inline-flex w-2 h-2 rounded-full ${
                                  story.sourceInfo.credibility === 'high' ? 'bg-green-500' :
                                  story.sourceInfo.credibility === 'medium' ? 'bg-yellow-500' :
                                  'bg-red-500'
                                }`} title={`${story.sourceInfo.credibility} credibility`} />
                              )}
                            </span>
                            {(() => {
                              const publishedDate = formatDate(story.publishedAt);
                              const addedDate = formatDate(story.addedAt, false);
                              
                              if (publishedDate) {
                                return (
                                  <>
                                    <span className="text-xs text-gray-400 dark:text-gray-500">•</span>
                                    <span className="text-xs text-gray-400 dark:text-gray-500">
                                      {publishedDate}
                                    </span>
                                  </>
                                );
                              } else if (addedDate) {
                                return (
                                  <>
                                    <span className="text-xs text-gray-400 dark:text-gray-500">•</span>
                                    <span className="text-xs text-gray-400 dark:text-gray-500">
                                      Added {addedDate}
                                    </span>
                                  </>
                                );
                              }
                              return null;
                            })()}
                          </div>
                          
                          {/* Title */}
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-1 line-clamp-2">
                            {story.title}
                          </h4>
                          
                          {/* Description */}
                          {story.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                              {story.description}
                            </p>
                          )}
                          
                          {/* URL and actions */}
                          <div className="flex items-center gap-2 mt-2">
                            <a
                              href={story.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-shrink-0 text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 flex items-center gap-1"
                            >
                              Open
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                            <span className="text-xs text-gray-400 dark:text-gray-500">•</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                                {(() => {
                                  try {
                                    const url = new URL(story.url);
                                    return `${url.hostname}${url.pathname}`;
                                  } catch {
                                    return story.url;
                                  }
                                })()}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                  })}
                </div>
              </div>
            ))}
            
            {/* Load more indicator */}
            {displayCount < filteredAndSortedStories.length && (
              <div className="py-4 text-center">
                {isLoadingMore ? (
                  <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-sm">Loading more stories...</span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Scroll for more ({filteredAndSortedStories.length - displayCount} remaining)
                  </p>
                )}
              </div>
            )}
            
            {/* End of stories */}
            {displayCount >= filteredAndSortedStories.length && filteredAndSortedStories.length > 0 && (
              <div className="py-4 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No more stories available
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}