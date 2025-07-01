import { collection, getDocs, doc, getDoc, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Bundle, ContentItem } from '@/types';
import { BundleItemsService } from './bundleItemsService';
import { activityLog } from './activityLogService';
import { FirestoreStoryCacheService } from './firestoreStoryCacheService';
import { RemovedStoriesService } from './removedStoriesService';

interface FeedItem {
  title: string;
  link: string;
  pubDate?: string;
  contentSnippet?: string;
  categories?: string[];
  thumbnail?: string;
  guid?: string;
}

interface Feed {
  id: string;
  title: string;
  url: string;
  type?: 'rss' | 'twitter' | 'youtube';
  items?: FeedItem[];
}

interface SearchResult {
  feedId: string;
  feedTitle: string;
  feedType: 'rss' | 'twitter' | 'youtube';
  item: FeedItem;
  relevanceScore: number;
}

export class BundleSearchService {
  private static feedsCache: Map<string, { data: Feed[]; timestamp: number }> = new Map();
  private static suggestionsCache: Map<string, { data: ContentItem[]; timestamp: number }> = new Map();
  private static pendingRequests: Map<string, Promise<ContentItem[]>> = new Map();
  private static readonly CACHE_DURATION = Infinity; // Never expire cache automatically
  private static readonly STORAGE_KEY_PREFIX = 'bundle_stories_cache_';
  
  // Initialize cache from localStorage on first access
  private static initializeCache() {
    if (typeof window === 'undefined') return;
    
    // Load all cached bundles from localStorage
    const keys = Object.keys(localStorage).filter(key => key.startsWith(this.STORAGE_KEY_PREFIX));
    keys.forEach(key => {
      try {
        const bundleId = key.replace(this.STORAGE_KEY_PREFIX, '');
        const cached = JSON.parse(localStorage.getItem(key) || '');
        if (cached && cached.data) {
          this.suggestionsCache.set(`suggestions-${bundleId}`, cached);
          console.log(`Loaded cached stories for bundle ${bundleId} from localStorage`);
        }
      } catch (error) {
        console.error(`Failed to load cache for ${key}:`, error);
        localStorage.removeItem(key);
      }
    });
  }
  
  // Save cache to localStorage
  private static persistCache(bundleId: string, data: ContentItem[]) {
    if (typeof window === 'undefined') return;
    
    try {
      const storageKey = `${this.STORAGE_KEY_PREFIX}${bundleId}`;
      const cacheData = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(storageKey, JSON.stringify(cacheData));
      console.log(`Persisted cache for bundle ${bundleId} to localStorage`);
    } catch (error) {
      console.error('Failed to persist cache to localStorage:', error);
      // If localStorage is full, clear old caches
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        this.clearOldCaches();
      }
    }
  }
  
  // Clear old caches if localStorage is full
  private static clearOldCaches() {
    const keys = Object.keys(localStorage).filter(key => key.startsWith(this.STORAGE_KEY_PREFIX));
    // Remove the oldest half of caches
    const toRemove = Math.floor(keys.length / 2);
    keys.slice(0, toRemove).forEach(key => {
      localStorage.removeItem(key);
      const bundleId = key.replace(this.STORAGE_KEY_PREFIX, '');
      this.suggestionsCache.delete(`suggestions-${bundleId}`);
    });
    console.log(`Cleared ${toRemove} old caches to free up localStorage space`);
  }
  
  // Clear cache for a specific bundle
  static async clearCacheForBundle(bundleId: string) {
    const cacheKey = `suggestions-${bundleId}`;
    this.suggestionsCache.delete(cacheKey);
    this.pendingRequests.delete(cacheKey);
    
    // Clear from localStorage
    if (typeof window !== 'undefined') {
      const storageKey = `${this.STORAGE_KEY_PREFIX}${bundleId}`;
      localStorage.removeItem(storageKey);
      console.log(`Cleared cache for bundle ${bundleId} from localStorage`);
    }
    
    // Clear from Firestore
    try {
      await FirestoreStoryCacheService.clearCache(bundleId);
      console.log(`Cleared cache for bundle ${bundleId} from Firestore`);
    } catch (error) {
      console.error('Failed to clear Firestore cache:', error);
      // Continue even if Firestore clear fails
    }
  }
  
  // Get cached stories without triggering a fetch
  static async getCachedStories(bundleId: string): Promise<ContentItem[] | null> {
    let cachedStories: ContentItem[] | null = null;
    
    // Try Firestore cache first (works across devices and sessions)
    try {
      const firestoreCached = await FirestoreStoryCacheService.getCachedStories(bundleId);
      if (firestoreCached) {
        console.log('Found cached suggestions in Firestore for bundle:', bundleId);
        cachedStories = firestoreCached;
      }
    } catch (error) {
      console.error('Error loading from Firestore cache:', error);
      // Fall back to local cache if Firestore fails
    }
    
    // Fall back to localStorage cache if no Firestore cache
    if (!cachedStories) {
      if (this.suggestionsCache.size === 0 && typeof window !== 'undefined') {
        this.initializeCache();
      }
      
      const cacheKey = `suggestions-${bundleId}`;
      const cached = this.suggestionsCache.get(cacheKey);
      if (cached) {
        console.log('Found cached suggestions in localStorage for bundle:', bundleId);
        cachedStories = cached.data;
      }
    }
    
    if (!cachedStories) {
      console.log('No cached suggestions found for bundle:', bundleId);
      return null;
    }
    
    // Filter out removed stories from cached results
    try {
      const removedStoryUrls = await RemovedStoriesService.getRemovedStoriesForBundle(bundleId);
      if (removedStoryUrls.length > 0) {
        console.log(`Filtering ${removedStoryUrls.length} removed stories from cached results`);
        const filteredStories = cachedStories.filter(story => {
          const isRemoved = removedStoryUrls.includes(story.url);
          if (isRemoved) {
            console.log(`Filtering out removed cached story: "${story.title.substring(0, 50)}..."`);
          }
          return !isRemoved;
        });
        cachedStories = filteredStories;
        console.log(`After filtering: ${cachedStories.length} cached stories remaining`);
      }
    } catch (error) {
      console.error('Error filtering removed stories from cache:', error);
      // Continue with unfiltered cache if filtering fails
    }
    
    // Update local cache with filtered results
    const cacheKey = `suggestions-${bundleId}`;
    this.suggestionsCache.set(cacheKey, {
      data: cachedStories,
      timestamp: Date.now()
    });
    
    return cachedStories;
  }
  
  // Check if item matches bundle criteria - require phrase matching for multi-word terms
  private static matchesBundleCriteria(
    item: any,
    bundleTitle: string,
    searchTerms: string[] = []
  ): boolean {
    // Combine all searchable fields
    const searchableText = [
      item.title || '',
      item.contentSnippet || '',
      item.description || '',
      item.content || '',
      item.link || '',
      item.author || '',
      item.creator || '',
      ...(item.categories || [])
    ].join(' ').toLowerCase();
    
    // Check bundle title first - as a complete phrase if multi-word
    const bundleTitleLower = bundleTitle.toLowerCase();
    const bundleTitleWords = bundleTitleLower.split(/\s+/).filter(w => w.length > 2);
    
    // For multi-word bundle titles, require the complete phrase OR all significant words
    if (bundleTitleWords.length > 1) {
      // Check for complete phrase
      if (searchableText.includes(bundleTitleLower)) {
        return true;
      }
      
      // For names (2 words), require at least one word to match
      if (bundleTitleWords.length === 2) {
        for (const word of bundleTitleWords) {
          if (searchableText.includes(word)) {
            return true;
          }
        }
      } else {
        // For longer phrases, require all words to be present
        const allWordsPresent = bundleTitleWords.every(word => searchableText.includes(word));
        if (allWordsPresent) {
          return true;
        }
      }
    } else if (bundleTitleWords.length === 1) {
      // Single word bundle title
      if (searchableText.includes(bundleTitleWords[0])) {
        return true;
      }
    }
    
    // Check search terms - require exact phrase match for multi-word terms
    for (const term of searchTerms) {
      const termLower = term.toLowerCase();
      const termWords = termLower.split(/\s+/).filter(w => w.length > 2);
      
      if (termWords.length > 1) {
        // Multi-word search term - require exact phrase
        if (searchableText.includes(termLower)) {
          return true;
        }
      } else if (termWords.length === 1) {
        // Single word search term
        if (searchableText.includes(termWords[0])) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  // Calculate relevance score based on title and description matches
  private static calculateRelevanceScore(
    itemTitle: string,
    itemContent: string | undefined,
    searchTitle: string,
    searchDescription: string | undefined,
    searchTerms: string[] = []
  ): number {
    let score = 0;
    
    const titleLower = itemTitle.toLowerCase();
    const contentLower = (itemContent || '').toLowerCase();
    const searchTitleLower = searchTitle.toLowerCase();
    const searchDescLower = (searchDescription || '').toLowerCase();
    
    // Title matches with word boundaries for better accuracy
    const titleWords = searchTitleLower.split(' ').filter(w => w.length > 2);
    titleWords.forEach(word => {
      try {
        const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const wordRegex = new RegExp(`\\b${escapedWord}\\b`, 'i');
        if (wordRegex.test(itemTitle)) {
          score += 15; // Increased from 10
        } else if (titleLower.includes(word)) {
          score += 5; // Partial match gets lower score
        }
      } catch (e) {
        // Fallback to simple includes if regex fails
        if (titleLower.includes(word)) {
          score += 10;
        }
      }
    });
    
    // Search terms matches (higher priority)
    searchTerms.forEach(term => {
      const termLower = term.toLowerCase();
      // Check for exact phrase match first
      if (titleLower.includes(termLower)) {
        score += 25; // Much higher score for exact search term matches
      } else if (contentLower.includes(termLower)) {
        score += 15; // Good score for search term matches in content
      } else {
        // Check if all words in the search term appear
        const termWords = termLower.split(' ').filter(w => w.length > 2);
        if (termWords.length > 1) {
          const allWordsInTitle = termWords.every(word => titleLower.includes(word));
          const allWordsInContent = termWords.every(word => contentLower.includes(word));
          if (allWordsInTitle) score += 20;
          else if (allWordsInContent) score += 10;
        }
      }
    });
    
    // Description keyword matches
    if (searchDescLower) {
      const descWords = searchDescLower.split(' ').filter(w => w.length > 3);
      descWords.forEach(word => {
        if (titleLower.includes(word)) {
          score += 5;
        }
        if (contentLower.includes(word)) {
          score += 3;
        }
      });
    }
    
    // Note: pubDate boost will be handled separately
    
    
    return score;
  }
  
  // Search all feeds for content relevant to a bundle - pulls from indexed feedItems
  static async searchFeedsForBundle(bundle: Bundle): Promise<SearchResult[]> {
    try {
      const results: SearchResult[] = [];
      
      console.log(`[BundleSearch] Starting search for bundle "${bundle.title}"`);
      console.log(`[BundleSearch] Search terms: ${bundle.searchTerms?.join(', ') || 'none'}`);
      
      // Get feed info for later use
      const feedsSnapshot = await getDocs(collection(db, 'rssFeeds'));
      const feedsMap = new Map<string, Feed>();
      feedsSnapshot.docs.forEach(doc => {
        feedsMap.set(doc.id, {
          id: doc.id,
          title: doc.data().title,
          url: doc.data().url,
          type: doc.data().type
        });
      });
      
      // Determine which feeds to search
      let feedIds: string[] = [];
      if (bundle.selectedFeedIds && bundle.selectedFeedIds.length > 0) {
        feedIds = bundle.selectedFeedIds;
        console.log(`[BundleSearch] Searching ${feedIds.length} selected feeds`);
      } else {
        feedIds = Array.from(feedsMap.keys());
        console.log(`[BundleSearch] No feeds selected, searching all ${feedIds.length} feeds`);
      }
      
      // Query the indexed feedItems collection directly
      // This pulls from the already-refreshed feed data
      console.log(`[BundleSearch] Querying indexed feedItems collection...`);
      
      // Build a more efficient query to get recent items from all feeds
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // Get items from the last 30 days, ordered by pubDate
      const itemsQuery = query(
        collection(db, 'feedItems'),
        where('pubDate', '>=', thirtyDaysAgo),
        orderBy('pubDate', 'desc'),
        limit(1000) // Get a good sample of recent items
      );
      
      const itemsSnapshot = await getDocs(itemsQuery);
      console.log(`[BundleSearch] Found ${itemsSnapshot.size} recent items in feedItems index`);
      
      // Process items
      let processedCount = 0;
      let matchCount = 0;
      
      itemsSnapshot.docs.forEach(doc => {
        const item = doc.data();
        processedCount++;
        
        // Skip if not from a selected feed (when feeds are selected)
        if (bundle.selectedFeedIds && bundle.selectedFeedIds.length > 0 && 
            !bundle.selectedFeedIds.includes(item.feedId)) {
          return;
        }
        
        // Get feed info
        const feed = feedsMap.get(item.feedId);
        if (!feed) return;
        
        // Check if item matches bundle criteria
        if (!this.matchesBundleCriteria(item, bundle.title, bundle.searchTerms || [])) {
          return;
        }
        
        matchCount++;
        
        // Calculate relevance score
        let score = this.calculateRelevanceScore(
          item.title,
          item.contentSnippet || item.description,
          bundle.title,
          bundle.description,
          bundle.searchTerms || []
        );
        
        // Boost for recent items
        if (item.pubDate) {
          try {
            const pubDate = item.pubDate.toDate ? item.pubDate.toDate() : new Date(item.pubDate);
            const daysSincePublished = (Date.now() - pubDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSincePublished < 1) score += 5;
            else if (daysSincePublished < 3) score += 3;
            else if (daysSincePublished < 7) score += 1;
          } catch (e) {
            // Invalid date, skip boost
          }
        }
        
        // Add variety bonus for non-Twitter content
        if (feed.type !== 'twitter') {
          score += 3;
        }
        
        // Create search result
        results.push({
          feedId: feed.id,
          feedTitle: feed.title,
          feedType: feed.type || 'rss',
          item: {
            title: item.title,
            link: item.link,
            pubDate: item.pubDate?.toDate ? item.pubDate.toDate().toISOString() : item.pubDate,
            contentSnippet: item.contentSnippet || item.description,
            thumbnail: item.thumbnail,
            guid: item.guid || item.link
          },
          relevanceScore: score
        });
      });
      
      console.log(`[BundleSearch] Processed ${processedCount} items, found ${matchCount} matches`);
      
      // Sort by relevance score (highest first)
      results.sort((a, b) => b.relevanceScore - a.relevanceScore);
      
      // Log feed type distribution
      const feedTypeCounts: Record<string, number> = {};
      results.forEach(result => {
        const type = result.feedType || 'unknown';
        feedTypeCounts[type] = (feedTypeCounts[type] || 0) + 1;
      });
      
      console.log(`[BundleSearch] Final results: ${results.length} stories`);
      console.log('[BundleSearch] Feed type distribution:', feedTypeCounts);
      
      return results;
    } catch (error) {
      console.error('[BundleSearch] Error searching feeds:', error);
      return [];
    }
  }
  
  // Refresh bundle stories from indexed feed items (doesn't refresh feeds)
  static async refreshBundleStoriesFromIndex(bundleId: string): Promise<ContentItem[]> {
    console.log(`[BundleRefresh] Refreshing stories for bundle ${bundleId} from feed index`);
    
    // Clear cache to force fresh search from indexed items
    await this.clearCacheForBundle(bundleId);
    
    // Now get fresh stories from the indexed feed items
    return this.getSuggestedStoriesForBundle(bundleId);
  }

  // Get suggested stories for a bundle (combines feed search with AI suggestions)
  static async getSuggestedStoriesForBundle(bundleId: string, forceRefresh: boolean = false): Promise<ContentItem[]> {
    try {
      // Try to get from cache first (will check Firestore then localStorage)
      if (!forceRefresh) {
        const cachedStories = await this.getCachedStories(bundleId);
        if (cachedStories) {
          console.log(`[BundleSearch] Returning ${cachedStories.length} cached stories for bundle ${bundleId}`);
          return cachedStories;
        }
      }

      // Check if there's already a pending request for this bundle
      const cacheKey = `suggestions-${bundleId}`;
      const pendingRequest = this.pendingRequests.get(cacheKey);
      if (pendingRequest) {
        console.log('[BundleSearch] Waiting for pending request for bundle:', bundleId);
        return pendingRequest;
      }

      // Create new request promise
      const requestPromise = (async () => {
        try {
          // Get the bundle details
          const bundleDoc = await getDoc(doc(db, 'bundles', bundleId));
          if (!bundleDoc.exists()) {
            throw new Error('Bundle not found');
          }
          
          const bundle = {
            id: bundleDoc.id,
            ...bundleDoc.data()
          } as Bundle;
          
          console.log('[BundleSearch] Bundle data:', {
            id: bundle.id,
            title: bundle.title,
            selectedFeedIds: bundle.selectedFeedIds,
            selectedFeedCount: bundle.selectedFeedIds?.length || 0,
            searchTerms: bundle.searchTerms,
            description: bundle.description
          });
          
          activityLog.startBundleSearch(bundle.title, bundle.id);
          
          // If this is Leticia James bundle, log more details
          if (bundle.title.toLowerCase().includes('leticia') || bundle.title.toLowerCase().includes('james')) {
            console.log('Leticia James bundle - searching with criteria:', {
              title: bundle.title,
              searchTerms: bundle.searchTerms,
              selectedFeeds: bundle.selectedFeedIds?.length || 'all feeds'
            });
          }
          
          // Get pre-matched bundle items (dual approach)
          const bundleItems = await BundleItemsService.getBundleItems(bundleId);
          console.log(`Found ${bundleItems.length} pre-matched items for bundle "${bundle.title}"`);
          activityLog.info(`Found ${bundleItems.length} pre-matched items for ${bundle.title}`);
          
          // Search indexed feed items for relevant content
          activityLog.info(`Searching indexed feed items for ${bundle.title}...`);
          const searchResults = await this.searchFeedsForBundle(bundle);
          console.log(`[BundleSearch] Search returned ${searchResults.length} results`);
          
          // Ensure searchResults is an array
          if (!Array.isArray(searchResults)) {
            console.warn('Search results is not an array:', searchResults);
            return [];
          }
          
          // Create a Set to track unique items (avoid duplicates)
          const uniqueItems = new Map<string, any>();
          
          // Add pre-matched bundle items first (they have precedence)
          bundleItems.forEach(item => {
            const key = item.link || item.itemId;
            uniqueItems.set(key, {
              feedId: item.feedId,
              feedTitle: item.feedTitle,
              feedType: item.feedType as any,
              item: {
                title: item.title,
                link: item.link,
                pubDate: item.pubDate,
                contentSnippet: item.contentSnippet,
                thumbnail: item.thumbnail,
                guid: item.itemId
              },
              relevanceScore: item.relevanceScore
            });
          });
          
          // Add search results (avoiding duplicates)
          searchResults.forEach(result => {
            const key = result.item.link || result.item.guid || '';
            if (key && !uniqueItems.has(key)) {
              uniqueItems.set(key, result);
            }
          });
          
          // Convert to array and sort by relevance
          const allResults = Array.from(uniqueItems.values());
          allResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
          
          const newFromSearch = searchResults.length - (searchResults.length - allResults.length + bundleItems.length);
          console.log(`Total unique stories for bundle "${bundle.title}": ${allResults.length} (${bundleItems.length} pre-matched + ${newFromSearch} from search)`);
          activityLog.completeBundleSearch(bundle.title, bundle.id, allResults.length);
          
          // Get removed stories for this bundle
          const removedStoryUrls = await RemovedStoriesService.getRemovedStoriesForBundle(bundleId);
          console.log(`Found ${removedStoryUrls.length} removed stories for bundle "${bundle.title}"`);
          
          // Filter out removed stories
          const filteredResults = allResults.filter(result => {
            const isRemoved = removedStoryUrls.includes(result.item.link);
            if (isRemoved) {
              console.log(`Filtering out removed story: "${result.item.title.substring(0, 50)}..."`);
            }
            return !isRemoved;
          });
          
          console.log(`After filtering removed stories: ${filteredResults.length} stories remaining`);
          
          // Convert search results to ContentItem format
          const suggestedStories: ContentItem[] = filteredResults.map((result, index) => {
            // Parse publication date more carefully
            let publishedAt: Date | undefined;
            if (result.item.pubDate) {
              try {
                const pubDate = new Date(result.item.pubDate);
                if (!isNaN(pubDate.getTime())) {
                  publishedAt = pubDate;
                }
              } catch (e) {
                console.warn('Invalid pubDate for item:', result.item.title, result.item.pubDate);
              }
            }
            
            return {
              id: `suggested-${bundleId}-${index}`,
              bundleId,
              sourceType: result.feedType === 'youtube' ? 'video' : 
                         result.feedType === 'twitter' ? 'tweet' : 'article',
              url: result.item.link,
              title: result.item.title,
              description: result.item.contentSnippet,
              thumbnail: result.item.thumbnail,
              publishedAt,
              sourceInfo: {
                name: result.feedTitle,
                credibility: 'medium' // Default, could be enhanced based on feed reputation
              },
              priority: false,
              userAction: 'unreviewed',
              addedAt: new Date(Date.now() + index), // Add index milliseconds to make them unique
              order: index
            };
          });
          
          // Cache the results
          this.suggestionsCache.set(cacheKey, {
            data: suggestedStories,
            timestamp: Date.now()
          });
          
          // Persist to localStorage
          this.persistCache(bundleId, suggestedStories);
          
          // Also persist to Firestore for cross-device sync
          try {
            await FirestoreStoryCacheService.saveToCache(
              bundleId,
              bundle.title,
              suggestedStories,
              bundle.searchTerms,
              bundle.selectedFeedIds
            );
            console.log(`Saved ${suggestedStories.length} stories to Firestore cache`);
          } catch (error) {
            console.error('Failed to save to Firestore cache:', error);
            // Continue even if Firestore save fails
          }
          
          console.log(`[BundleSearch] Generated ${suggestedStories.length} suggested stories for bundle:`, bundleId);
          
          // Don't log here since we already logged in completeBundleSearch
          
          // Debug: Log date information for first few stories
          if (suggestedStories.length > 0) {
            console.log('Sample story dates:');
            suggestedStories.slice(0, 3).forEach((story, i) => {
              console.log(`Story ${i}: ${story.title.substring(0, 50)}... - Published: ${story.publishedAt || 'none'}, Added: ${story.addedAt}`);
            });
          }
          
          return suggestedStories;
        } finally {
          // Remove from pending requests
          this.pendingRequests.delete(cacheKey);
        }
      })();

      // Store the pending request
      this.pendingRequests.set(cacheKey, requestPromise);
      
      return requestPromise;
    } catch (error) {
      console.error('Error getting suggested stories:', error);
      activityLog.error(`Failed to get suggested stories: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }
  
  // Clear all cache
  static clearAllCache() {
    this.suggestionsCache.clear();
    console.log('Cleared all bundle search cache');
  }
  
  // Search for content across multiple platforms (placeholder for future AI integration)
  static async searchWithAI(query: string, platforms: string[]): Promise<any[]> {
    // This will be implemented when we add AI integration
    // For now, return empty array
    console.log('AI search not yet implemented:', query, platforms);
    return [];
  }
}