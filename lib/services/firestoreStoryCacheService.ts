import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  orderBy, 
  limit,
  writeBatch,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ContentItem } from '@/types';
import { StoryCacheDocument, StoryCacheChunk, CachedStory } from '@/types/storyCache';
import { cleanFirestoreData } from '@/lib/utils/firebaseHelpers';
import { activityLog } from './activityLogService';

export class FirestoreStoryCacheService {
  private static readonly CACHE_COLLECTION = 'bundleStoryCache';
  private static readonly CHUNK_SIZE = 100; // Stories per chunk
  private static readonly MAX_CHUNK_SIZE = 900 * 1024; // 900KB to stay under 1MB limit
  private static readonly DEFAULT_MAX_AGE_HOURS = 24 * 7; // 1 week default
  
  // Convert ContentItem to CachedStory (minimal data for storage)
  private static contentItemToCachedStory(item: ContentItem, order: number): CachedStory {
    return {
      id: item.id,
      url: item.url,
      title: item.title,
      description: item.description,
      thumbnail: item.thumbnail,
      sourceType: item.sourceType,
      sourceName: item.sourceInfo.name,
      publishedAt: item.publishedAt instanceof Date ? item.publishedAt : (item.publishedAt ? new Date(item.publishedAt) : undefined),
      relevanceScore: 0, // Will be set by search service
      order,
      metadata: {}
    };
  }
  
  // Convert CachedStory back to ContentItem
  private static cachedStoryToContentItem(story: CachedStory, bundleId: string): ContentItem {
    return {
      id: story.id,
      bundleId,
      sourceType: story.sourceType,
      url: story.url,
      title: story.title,
      description: story.description,
      thumbnail: story.thumbnail,
      publishedAt: story.publishedAt,
      sourceInfo: {
        name: story.sourceName,
        credibility: 'medium' // Default, could be enhanced
      },
      priority: false,
      userAction: 'unreviewed',
      addedAt: new Date(),
      order: story.order
    };
  }
  
  // Get cache for a bundle
  static async getCachedStories(bundleId: string): Promise<ContentItem[] | null> {
    try {
      activityLog.info(`Checking Firestore cache for bundle ${bundleId}`);
      
      // Get cache metadata
      const cacheDoc = await getDoc(doc(db, this.CACHE_COLLECTION, bundleId));
      if (!cacheDoc.exists()) {
        console.log('No Firestore cache found for bundle:', bundleId);
        return null;
      }
      
      const cacheData = cacheDoc.data() as StoryCacheDocument;
      
      // Update last accessed time
      await updateDoc(doc(db, this.CACHE_COLLECTION, bundleId), {
        lastAccessed: serverTimestamp()
      });
      
      // Check if cache is stale
      const lastRefreshed = cacheData.lastRefreshed as any;
      const refreshDate = lastRefreshed?.toDate ? lastRefreshed.toDate() : new Date(lastRefreshed);
      const ageHours = (Date.now() - refreshDate.getTime()) / (1000 * 60 * 60);
      if (ageHours > (cacheData.settings?.maxAgeHours || this.DEFAULT_MAX_AGE_HOURS)) {
        console.log(`Cache for bundle ${bundleId} is stale (${ageHours.toFixed(1)} hours old)`);
        // Don't return null - return stale cache but mark it
        activityLog.warning(`Using stale cache for bundle ${bundleId} (${ageHours.toFixed(1)} hours old)`);
      }
      
      // Load all story chunks
      const chunksCollection = collection(db, this.CACHE_COLLECTION, bundleId, 'storyChunks');
      const chunksQuery = query(chunksCollection, orderBy('chunkIndex'));
      const chunksSnapshot = await getDocs(chunksQuery);
      
      const allStories: ContentItem[] = [];
      chunksSnapshot.forEach(chunkDoc => {
        const chunk = chunkDoc.data() as StoryCacheChunk;
        const contentItems = chunk.stories.map(story => 
          this.cachedStoryToContentItem(story, bundleId)
        );
        allStories.push(...contentItems);
      });
      
      console.log(`Loaded ${allStories.length} stories from Firestore cache for bundle ${bundleId}`);
      activityLog.success(`Loaded ${allStories.length} cached stories from Firestore`);
      
      return allStories;
    } catch (error) {
      console.error('Error loading from Firestore cache:', error);
      activityLog.error(`Failed to load Firestore cache: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }
  
  // Save stories to cache
  static async saveToCache(
    bundleId: string, 
    bundleTitle: string,
    stories: ContentItem[],
    searchTerms?: string[],
    selectedFeedIds?: string[]
  ): Promise<void> {
    try {
      activityLog.info(`Saving ${stories.length} stories to Firestore cache for bundle ${bundleId}`);
      
      // Calculate summary data
      const summary = {
        totalStories: stories.length,
        storiesByType: {} as Record<string, number>,
        storiesBySource: {} as Record<string, number>,
        dateRange: {
          earliest: null as Date | null,
          latest: null as Date | null
        }
      };
      
      // Build summary
      stories.forEach(story => {
        // Count by type
        summary.storiesByType[story.sourceType] = (summary.storiesByType[story.sourceType] || 0) + 1;
        
        // Count by source
        summary.storiesBySource[story.sourceInfo.name] = (summary.storiesBySource[story.sourceInfo.name] || 0) + 1;
        
        // Track date range
        if (story.publishedAt) {
          const date = story.publishedAt instanceof Date ? story.publishedAt : new Date(story.publishedAt);
          if (!summary.dateRange.earliest || date < summary.dateRange.earliest) {
            summary.dateRange.earliest = date;
          }
          if (!summary.dateRange.latest || date > summary.dateRange.latest) {
            summary.dateRange.latest = date;
          }
        }
      });
      
      // Convert stories to cached format and chunk them
      const chunks: StoryCacheChunk[] = [];
      let currentChunk: CachedStory[] = [];
      let currentChunkSize = 0;
      let chunkIndex = 0;
      
      stories.forEach((story, index) => {
        const cachedStory = this.contentItemToCachedStory(story, index);
        const storySize = JSON.stringify(cachedStory).length;
        
        // Start new chunk if current one is full
        if (currentChunk.length >= this.CHUNK_SIZE || 
            currentChunkSize + storySize > this.MAX_CHUNK_SIZE) {
          if (currentChunk.length > 0) {
            chunks.push({
              id: `chunk-${chunkIndex}`,
              bundleId,
              chunkIndex,
              stories: currentChunk,
              storyCount: currentChunk.length,
              sizeEstimate: currentChunkSize,
              createdAt: new Date()
            });
            chunkIndex++;
            currentChunk = [];
            currentChunkSize = 0;
          }
        }
        
        currentChunk.push(cachedStory);
        currentChunkSize += storySize;
      });
      
      // Add final chunk
      if (currentChunk.length > 0) {
        chunks.push({
          id: `chunk-${chunkIndex}`,
          bundleId,
          chunkIndex,
          stories: currentChunk,
          storyCount: currentChunk.length,
          sizeEstimate: currentChunkSize,
          createdAt: new Date()
        });
      }
      
      // Create cache document
      const cacheDoc: StoryCacheDocument = {
        id: bundleId,
        bundleId,
        bundleTitle,
        lastRefreshed: new Date(),
        lastAccessed: new Date(),
        storyCount: stories.length,
        chunkCount: chunks.length,
        searchTerms,
        selectedFeedIds,
        cacheVersion: 1,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        summary: cleanFirestoreData(summary),
        settings: {
          maxAgeHours: this.DEFAULT_MAX_AGE_HOURS,
          deduplicationMethod: 'url'
        }
      };
      
      // Use batch write for efficiency
      const batch = writeBatch(db);
      
      // Write main cache document
      batch.set(doc(db, this.CACHE_COLLECTION, bundleId), cleanFirestoreData(cacheDoc));
      
      // Write chunks
      chunks.forEach(chunk => {
        const chunkRef = doc(db, this.CACHE_COLLECTION, bundleId, 'storyChunks', chunk.id);
        batch.set(chunkRef, cleanFirestoreData(chunk));
      });
      
      // Commit batch
      await batch.commit();
      
      console.log(`Saved ${stories.length} stories in ${chunks.length} chunks to Firestore cache`);
      activityLog.success(`Cached ${stories.length} stories to Firestore`);
      
    } catch (error) {
      console.error('Error saving to Firestore cache:', error);
      activityLog.error(`Failed to save Firestore cache: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
  
  // Clear cache for a bundle
  static async clearCache(bundleId: string): Promise<void> {
    try {
      activityLog.info(`Clearing Firestore cache for bundle ${bundleId}`);
      
      // Delete all chunks first
      const chunksCollection = collection(db, this.CACHE_COLLECTION, bundleId, 'storyChunks');
      const chunksSnapshot = await getDocs(chunksCollection);
      
      const batch = writeBatch(db);
      chunksSnapshot.forEach(chunkDoc => {
        batch.delete(chunkDoc.ref);
      });
      
      // Delete main cache document
      batch.delete(doc(db, this.CACHE_COLLECTION, bundleId));
      
      await batch.commit();
      
      console.log(`Cleared Firestore cache for bundle ${bundleId}`);
      activityLog.success(`Cleared Firestore cache for bundle ${bundleId}`);
      
    } catch (error) {
      console.error('Error clearing Firestore cache:', error);
      activityLog.error(`Failed to clear Firestore cache: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
  
  // Get cache metadata without loading all stories
  static async getCacheMetadata(bundleId: string): Promise<StoryCacheDocument | null> {
    try {
      const cacheDoc = await getDoc(doc(db, this.CACHE_COLLECTION, bundleId));
      if (!cacheDoc.exists()) {
        return null;
      }
      
      return cacheDoc.data() as StoryCacheDocument;
    } catch (error) {
      console.error('Error getting cache metadata:', error);
      return null;
    }
  }
  
  // Check if cache exists and is fresh
  static async isCacheFresh(bundleId: string, maxAgeHours?: number): Promise<boolean> {
    const metadata = await this.getCacheMetadata(bundleId);
    if (!metadata) return false;
    
    const lastRefreshed = metadata.lastRefreshed as any;
    const refreshDate = lastRefreshed?.toDate ? lastRefreshed.toDate() : new Date(lastRefreshed);
    const ageHours = (Date.now() - refreshDate.getTime()) / (1000 * 60 * 60);
    const maxAge = maxAgeHours || metadata.settings?.maxAgeHours || this.DEFAULT_MAX_AGE_HOURS;
    
    return ageHours <= maxAge;
  }
}