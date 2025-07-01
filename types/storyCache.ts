// Story cache types for Firestore storage

// Type aliases for clarity
export type BundleStoryCache = StoryCacheDocument;
export type StoryChunk = StoryCacheChunk;
export type StoryIndex = StoryCacheIndex;

// Cache refresh configuration
export interface CacheRefreshConfig {
  bundleId?: string;
  forceRefresh?: boolean;
  maxAgeHours?: number;
  includeFeeds?: string[];
  excludeFeeds?: string[];
  searchTerms?: string[];
  selectedFeedIds?: string[];
  deduplication?: 'url' | 'title' | 'both';
}

// Cache statistics
export interface CacheStats {
  totalStories: number;
  totalChunks: number;
  sizeInBytes: number;
  lastRefreshed: Date;
  lastAccessed: Date;
  hitRate: number;
}

// Constants
export const STORY_CACHE_CONSTANTS = {
  MAX_CHUNK_SIZE: 100,
  MAX_CACHE_AGE_HOURS: 24,
  CHUNK_SIZE_LIMIT: 1024 * 1024, // 1MB
};

export const CACHE_COLLECTIONS = {
  CACHE_DOCS: 'storyCache',
  CACHE_CHUNKS: 'chunks',
  CACHE_INDEXES: 'indexes',
};

export interface StoryCacheDocument {
  id: string; // bundleId
  bundleId: string;
  bundleTitle: string;
  lastRefreshed: Date;
  lastAccessed: Date;
  storyCount: number;
  chunkCount: number;
  searchTerms?: string[];
  selectedFeedIds?: string[];
  cacheVersion: number; // For future schema migrations
  status: 'active' | 'refreshing' | 'error';
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Metadata
  metadata: {
    totalStoryCount: number;
    chunkCount: number;
    searchTerms: string[];
    selectedFeedIds: string[];
    cacheVersion: number;
  };
  
  // Summary data for quick access
  summary: {
    totalStories: number;
    storiesByType: Record<string, number>;
    storiesBySource: Record<string, number>;
    sourceDistribution: Record<string, number>;
    topSources: Array<{ name: string; count: number }>;
    dateRange: {
      earliest: Date | null;
      latest: Date | null;
    };
  };
  
  // Cache settings
  settings: {
    maxAgeHours: number; // How old cache can be before considered stale
    deduplicationMethod: 'url' | 'title' | 'both';
  };
}

// Individual story chunk - stored as subcollection
export interface StoryCacheChunk {
  id: string; // chunk-{index}
  bundleId: string;
  chunkIndex: number;
  stories: CachedStory[];
  storyCount: number;
  sizeEstimate: number; // Approximate size in bytes
  createdAt: Date;
}

// Cached story with essential fields only
export interface CachedStory {
  id: string;
  url: string;
  title: string;
  description?: string;
  thumbnail?: string;
  sourceType: 'article' | 'video' | 'tweet' | 'social';
  sourceName: string;
  publishedAt?: Date;
  relevanceScore: number;
  order: number;
  
  // Source information
  source?: {
    name: string;
    credibility?: 'high' | 'medium' | 'low';
    url?: string;
  };
  
  // Enrichment data
  enrichment?: {
    aiSummary?: string;
    entities?: string[];
    sentiment?: 'positive' | 'negative' | 'neutral';
  };
  
  // Minimal metadata
  metadata?: {
    author?: string;
    categories?: string[];
    duration?: string; // For videos
  };
}

// Index for fast lookups - stored as subcollection
export interface StoryCacheIndex {
  id: string; // 'byDate', 'bySource', etc.
  bundleId: string;
  indexType: 'date' | 'source' | 'relevance';
  entries: Array<{
    key: string; // date string, source name, or score range
    storyIds: string[];
    chunkIds: string[];
  }>;
  updatedAt: Date;
}