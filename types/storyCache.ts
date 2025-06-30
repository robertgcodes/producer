// Story cache types for Firestore storage
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
  
  // Summary data for quick access
  summary: {
    totalStories: number;
    storiesByType: Record<string, number>;
    storiesBySource: Record<string, number>;
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