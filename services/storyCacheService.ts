import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  writeBatch,
  serverTimestamp,
  increment,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  BundleStoryCache,
  StoryChunk,
  CachedStory,
  StoryIndex,
  CacheRefreshConfig,
  CacheStats,
  STORY_CACHE_CONSTANTS,
  CACHE_COLLECTIONS
} from '@/types/storyCache';

export class StoryCacheService {
  /**
   * Get or create a cache document for a bundle
   */
  static async getOrCreateCache(bundleId: string): Promise<BundleStoryCache> {
    const cacheRef = doc(db, CACHE_COLLECTIONS.CACHE_DOCS, bundleId);
    const cacheDoc = await getDoc(cacheRef);

    if (cacheDoc.exists()) {
      const data = cacheDoc.data();
      return {
        ...data,
        lastRefreshed: data.lastRefreshed?.toDate(),
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
      } as BundleStoryCache;
    }

    // Create new cache document
    const newCache: BundleStoryCache = {
      id: bundleId,
      bundleId,
      lastRefreshed: new Date(),
      refreshStatus: 'idle',
      metadata: {
        totalStoryCount: 0,
        chunkCount: 0,
        searchTerms: [],
        selectedFeedIds: [],
        cacheVersion: 1,
      },
      summary: {
        totalStories: 0,
        storiesByType: {},
        storiesBySource: {},
        dateRange: {
          earliest: null,
          latest: null,
        },
      },
      settings: {
        maxAgeHours: STORY_CACHE_CONSTANTS.MAX_CACHE_AGE_HOURS,
        deduplicationMethod: 'url',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await setDoc(cacheRef, {
      ...newCache,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return newCache;
  }

  /**
   * Check if cache needs refresh
   */
  static isCacheStale(cache: BundleStoryCache): boolean {
    const age = Date.now() - cache.lastRefreshed.getTime();
    return age > cache.settings.maxAgeHours;
  }

  /**
   * Add stories to cache in chunks
   */
  static async addStoriesToCache(
    bundleId: string,
    stories: CachedStory[],
    config: CacheRefreshConfig
  ): Promise<void> {
    const batch = writeBatch(db);
    const cacheRef = doc(db, CACHE_COLLECTIONS.CACHE_DOCS, bundleId);
    
    // Deduplicate stories
    const uniqueStories = this.deduplicateStories(stories, cache.settings.deduplicationMethod);
    
    // Split into chunks
    const chunks = this.createStoryChunks(uniqueStories);
    
    // Update cache metadata
    const metadata = {
      totalStoryCount: uniqueStories.length,
      chunkCount: chunks.length,
      searchTerms: config.searchTerms,
      selectedFeedIds: config.selectedFeedIds,
      cacheVersion: 1,
    };

    // Calculate summary data
    const summary = this.calculateSummary(uniqueStories);

    // Update main cache document
    batch.update(cacheRef, {
      lastRefreshed: serverTimestamp(),
      refreshStatus: 'completed',
      metadata,
      summary,
      updatedAt: serverTimestamp(),
    });

    // Write story chunks
    for (let i = 0; i < chunks.length; i++) {
      const chunkRef = doc(
        db,
        CACHE_COLLECTIONS.CACHE_DOCS,
        bundleId,
        CACHE_COLLECTIONS.CACHE_CHUNKS,
        `chunk_${i}`
      );
      
      batch.set(chunkRef, {
        id: `chunk_${i}`,
        chunkIndex: i,
        stories: chunks[i],
        storyCount: chunks[i].length,
        sizeBytes: JSON.stringify(chunks[i]).length,
        createdAt: serverTimestamp(),
      });
    }

    // Create indices
    await this.createIndices(bundleId, uniqueStories, chunks);

    // Commit batch
    await batch.commit();

    // Update cache stats
    await this.updateCacheStats(bundleId, 'write');
  }

  /**
   * Retrieve stories from cache
   */
  static async getStoriesFromCache(
    bundleId: string,
    options?: {
      limit?: number;
      offset?: number;
      sortBy?: 'date' | 'relevance' | 'source';
      filterSource?: string;
    }
  ): Promise<{ stories: CachedStory[]; hasMore: boolean }> {
    await this.updateCacheStats(bundleId, 'read');

    const cache = await this.getOrCreateCache(bundleId);
    
    if (this.isCacheStale(cache)) {
      return { stories: [], hasMore: false };
    }

    const chunksRef = collection(
      db,
      CACHE_COLLECTIONS.CACHE_DOCS,
      bundleId,
      CACHE_COLLECTIONS.CACHE_CHUNKS
    );

    const chunksQuery = query(
      chunksRef,
      orderBy('chunkIndex'),
      limit(Math.ceil((options?.limit || 100) / STORY_CACHE_CONSTANTS.MAX_CHUNK_SIZE))
    );

    const chunksSnapshot = await getDocs(chunksQuery);
    const allStories: CachedStory[] = [];

    chunksSnapshot.forEach((doc) => {
      const chunk = doc.data() as StoryChunk;
      allStories.push(...chunk.stories);
    });

    // Apply filters and sorting
    let filteredStories = allStories;
    
    if (options?.filterSource) {
      filteredStories = allStories.filter(s => s.source.name === options.filterSource);
    }

    // Sort stories
    if (options?.sortBy === 'date') {
      filteredStories.sort((a, b) => 
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
    } else if (options?.sortBy === 'relevance') {
      filteredStories.sort((a, b) => 
        (b.enrichment?.relevanceScore || 0) - (a.enrichment?.relevanceScore || 0)
      );
    }

    // Apply pagination
    const start = options?.offset || 0;
    const end = start + (options?.limit || 100);
    const paginatedStories = filteredStories.slice(start, end);

    return {
      stories: paginatedStories,
      hasMore: end < filteredStories.length,
    };
  }

  /**
   * Clear cache for a bundle
   */
  static async clearCache(bundleId: string): Promise<void> {
    const batch = writeBatch(db);
    
    // Get all chunks
    const chunksRef = collection(
      db,
      CACHE_COLLECTIONS.CACHE_DOCS,
      bundleId,
      CACHE_COLLECTIONS.CACHE_CHUNKS
    );
    
    const chunks = await getDocs(chunksRef);
    chunks.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Get all indices
    const indicesRef = collection(
      db,
      CACHE_COLLECTIONS.CACHE_DOCS,
      bundleId,
      CACHE_COLLECTIONS.CACHE_INDEXES
    );
    
    const indices = await getDocs(indicesRef);
    indices.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Update main cache document
    const cacheRef = doc(db, CACHE_COLLECTIONS.CACHE_DOCS, bundleId);
    batch.update(cacheRef, {
      refreshStatus: 'idle',
      metadata: {
        totalStoryCount: 0,
        chunkCount: 0,
        searchTerms: [],
        selectedFeedIds: [],
        cacheVersion: 1,
      },
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  }

  /**
   * Helper: Deduplicate stories
   */
  private static deduplicateStories(
    stories: CachedStory[],
    method: 'url' | 'title' | 'both'
  ): CachedStory[] {
    const seen = new Map<string, CachedStory>();
    
    for (const story of stories) {
      let key: string;
      
      if (method === 'url') {
        key = story.url;
      } else if (method === 'title') {
        key = story.title.toLowerCase().trim();
      } else {
        key = `${story.url}|${story.title.toLowerCase().trim()}`;
      }
      
      if (!seen.has(key)) {
        seen.set(key, story);
      } else {
        // Mark as duplicate
        story.duplicateOf = seen.get(key)!.id;
      }
    }
    
    return Array.from(seen.values());
  }

  /**
   * Helper: Create story chunks
   */
  private static createStoryChunks(stories: CachedStory[]): CachedStory[][] {
    const chunks: CachedStory[][] = [];
    let currentChunk: CachedStory[] = [];
    let currentSize = 0;

    for (const story of stories) {
      const storySize = JSON.stringify(story).length;
      
      if (
        currentChunk.length >= STORY_CACHE_CONSTANTS.MAX_CHUNK_SIZE ||
        currentSize + storySize > STORY_CACHE_CONSTANTS.MAX_CHUNK_SIZE_BYTES
      ) {
        chunks.push(currentChunk);
        currentChunk = [];
        currentSize = 0;
      }
      
      currentChunk.push(story);
      currentSize += storySize;
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Helper: Calculate summary data
   */
  private static calculateSummary(stories: CachedStory[]) {
    const sourceCount = new Map<string, number>();
    let earliestDate = new Date();
    let latestDate = new Date(0);

    for (const story of stories) {
      // Count sources
      const count = sourceCount.get(story.source.name) || 0;
      sourceCount.set(story.source.name, count + 1);

      // Track date range
      const storyDate = new Date(story.publishedAt);
      if (storyDate < earliestDate) earliestDate = storyDate;
      if (storyDate > latestDate) latestDate = storyDate;
    }

    // Get top sources
    const topSources = Array.from(sourceCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({
        name,
        count,
        credibility: stories.find(s => s.source.name === name)?.source.credibility,
      }));

    return {
      sourceDistribution: Object.fromEntries(sourceCount),
      dateRange: {
        earliest: earliestDate,
        latest: latestDate,
      },
      topSources,
    };
  }

  /**
   * Helper: Create indices for fast lookups
   */
  private static async createIndices(
    bundleId: string,
    stories: CachedStory[],
    chunks: CachedStory[][]
  ): Promise<void> {
    const batch = writeBatch(db);

    // Date index
    const dateIndex: StoryIndex = {
      id: 'byDate',
      type: 'date',
      entries: [],
      updatedAt: new Date(),
    };

    // Source index
    const sourceIndex: StoryIndex = {
      id: 'bySource',
      type: 'source',
      entries: [],
      updatedAt: new Date(),
    };

    // Build indices
    const dateMap = new Map<string, { storyIds: string[]; chunkIds: Set<string> }>();
    const sourceMap = new Map<string, { storyIds: string[]; chunkIds: Set<string> }>();

    chunks.forEach((chunk, chunkIndex) => {
      chunk.forEach((story) => {
        // Date index (by day)
        const dateKey = new Date(story.publishedAt).toISOString().split('T')[0];
        if (!dateMap.has(dateKey)) {
          dateMap.set(dateKey, { storyIds: [], chunkIds: new Set() });
        }
        dateMap.get(dateKey)!.storyIds.push(story.id);
        dateMap.get(dateKey)!.chunkIds.add(`chunk_${chunkIndex}`);

        // Source index
        if (!sourceMap.has(story.source.name)) {
          sourceMap.set(story.source.name, { storyIds: [], chunkIds: new Set() });
        }
        sourceMap.get(story.source.name)!.storyIds.push(story.id);
        sourceMap.get(story.source.name)!.chunkIds.add(`chunk_${chunkIndex}`);
      });
    });

    // Convert maps to index entries
    dateIndex.entries = Array.from(dateMap.entries()).map(([key, value]) => ({
      key,
      storyIds: value.storyIds,
      chunkIds: Array.from(value.chunkIds),
    }));

    sourceIndex.entries = Array.from(sourceMap.entries()).map(([key, value]) => ({
      key,
      storyIds: value.storyIds,
      chunkIds: Array.from(value.chunkIds),
    }));

    // Write indices
    const dateIndexRef = doc(
      db,
      CACHE_COLLECTIONS.CACHE_DOCS,
      bundleId,
      CACHE_COLLECTIONS.CACHE_INDEXES,
      'byDate'
    );
    batch.set(dateIndexRef, {
      ...dateIndex,
      updatedAt: serverTimestamp(),
    });

    const sourceIndexRef = doc(
      db,
      CACHE_COLLECTIONS.CACHE_DOCS,
      bundleId,
      CACHE_COLLECTIONS.CACHE_INDEXES,
      'bySource'
    );
    batch.set(sourceIndexRef, {
      ...sourceIndex,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  }

  /**
   * Helper: Update cache statistics
   */
  private static async updateCacheStats(
    bundleId: string,
    operation: 'read' | 'write'
  ): Promise<void> {
    const statsRef = doc(db, CACHE_COLLECTIONS.CACHE_STATS, bundleId);
    
    try {
      await updateDoc(statsRef, {
        [operation === 'read' ? 'hitCount' : 'missCount']: increment(1),
        lastAccessTime: serverTimestamp(),
      });
    } catch (error) {
      // Stats doc doesn't exist, create it
      await setDoc(statsRef, {
        id: bundleId,
        hitCount: operation === 'read' ? 1 : 0,
        missCount: operation === 'write' ? 1 : 0,
        lastAccessTime: serverTimestamp(),
        averageLoadTime: 0,
        totalSizeBytes: 0,
      });
    }
  }
}