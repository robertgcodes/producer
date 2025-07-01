import { useState, useEffect, useCallback } from 'react';
import { StoryCacheService } from '@/services/storyCacheService';
import { 
  BundleStoryCache, 
  CachedStory, 
  CacheRefreshConfig 
} from '@/types/storyCache';

interface UseStoryCacheOptions {
  bundleId: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
}

interface UseStoryCacheReturn {
  cache: BundleStoryCache | null;
  stories: CachedStory[];
  loading: boolean;
  error: string | null;
  isStale: boolean;
  hasMore: boolean;
  
  // Actions
  refreshCache: (config: CacheRefreshConfig) => Promise<void>;
  loadMoreStories: () => Promise<void>;
  clearCache: () => Promise<void>;
  getFilteredStories: (filter: {
    source?: string;
    dateRange?: { start: Date; end: Date };
  }) => CachedStory[];
}

export function useStoryCache({
  bundleId,
  autoRefresh = false,
  refreshInterval = 3600000, // 1 hour default
}: UseStoryCacheOptions): UseStoryCacheReturn {
  const [cache, setCache] = useState<BundleStoryCache | null>(null);
  const [stories, setStories] = useState<CachedStory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [currentOffset, setCurrentOffset] = useState(0);

  // Initialize cache
  useEffect(() => {
    const initCache = async () => {
      try {
        setLoading(true);
        const cacheData = await StoryCacheService.getOrCreateCache(bundleId);
        setCache(cacheData);
        
        // Load initial stories if cache has data
        if (cacheData.metadata.totalStoryCount > 0) {
          const result = await StoryCacheService.getStoriesFromCache(bundleId, {
            limit: 50,
            offset: 0,
            sortBy: 'date',
          });
          setStories(result.stories);
          setHasMore(result.hasMore);
          setCurrentOffset(result.stories.length);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize cache');
      } finally {
        setLoading(false);
      }
    };

    initCache();
  }, [bundleId]);

  // Auto-refresh logic
  useEffect(() => {
    if (!autoRefresh || !cache) return;

    const checkAndRefresh = async () => {
      if (StoryCacheService.isCacheStale(cache)) {
        // Trigger refresh with current config
        await refreshCache({
          bundleId,
          searchTerms: cache.metadata.searchTerms,
          selectedFeedIds: cache.metadata.selectedFeedIds,
          deduplication: cache.settings.deduplicationMethod,
        });
      }
    };

    const interval = setInterval(checkAndRefresh, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, cache, bundleId, refreshInterval]);

  const refreshCache = useCallback(async (config: CacheRefreshConfig) => {
    try {
      setLoading(true);
      setError(null);

      // Here you would fetch stories from your feed sources
      // For now, this is a placeholder - you'll integrate with your feed service
      const newStories: CachedStory[] = []; // TODO: Fetch from feeds

      // Add stories to cache
      await StoryCacheService.addStoriesToCache(bundleId, newStories, config);

      // Reload cache and stories
      const updatedCache = await StoryCacheService.getOrCreateCache(bundleId);
      setCache(updatedCache);

      const result = await StoryCacheService.getStoriesFromCache(bundleId, {
        limit: 50,
        offset: 0,
        sortBy: 'date',
      });
      
      setStories(result.stories);
      setHasMore(result.hasMore);
      setCurrentOffset(result.stories.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh cache');
    } finally {
      setLoading(false);
    }
  }, [bundleId]);

  const loadMoreStories = useCallback(async () => {
    if (loading || !hasMore) return;

    try {
      setLoading(true);
      const result = await StoryCacheService.getStoriesFromCache(bundleId, {
        limit: 50,
        offset: currentOffset,
        sortBy: 'date',
      });

      setStories(prev => [...prev, ...result.stories]);
      setHasMore(result.hasMore);
      setCurrentOffset(prev => prev + result.stories.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more stories');
    } finally {
      setLoading(false);
    }
  }, [bundleId, currentOffset, hasMore, loading]);

  const clearCache = useCallback(async () => {
    try {
      setLoading(true);
      await StoryCacheService.clearCache(bundleId);
      setStories([]);
      setHasMore(false);
      setCurrentOffset(0);
      
      // Reload empty cache
      const clearedCache = await StoryCacheService.getOrCreateCache(bundleId);
      setCache(clearedCache);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear cache');
    } finally {
      setLoading(false);
    }
  }, [bundleId]);

  const getFilteredStories = useCallback((filter: {
    source?: string;
    dateRange?: { start: Date; end: Date };
  }) => {
    return stories.filter(story => {
      // Filter by source
      if (filter.source && story.source?.name !== filter.source) {
        return false;
      }

      // Filter by date range
      if (filter.dateRange) {
        const storyDate = story.publishedAt ? new Date(story.publishedAt) : new Date();
        if (storyDate < filter.dateRange.start || storyDate > filter.dateRange.end) {
          return false;
        }
      }

      return true;
    });
  }, [stories]);

  const isStale = cache ? StoryCacheService.isCacheStale(cache) : false;

  return {
    cache,
    stories,
    loading,
    error,
    isStale,
    hasMore,
    refreshCache,
    loadMoreStories,
    clearCache,
    getFilteredStories,
  };
}