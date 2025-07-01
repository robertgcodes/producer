import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  getDocs,
  writeBatch,
  Timestamp,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cleanFirestoreData } from '@/lib/utils/firebaseHelpers';
import { activityLog } from './activityLogService';

export interface FeedStory {
  id: string;
  feedId: string;
  feedTitle: string;
  feedType: 'rss' | 'twitter';
  title: string;
  link: string;
  contentSnippet?: string;
  description?: string;
  pubDate: string;
  guid?: string;
  categories?: string[];
  thumbnail?: string;
  media?: any[];
  metrics?: {
    retweet_count?: number;
    reply_count?: number;
    like_count?: number;
    quote_count?: number;
  };
  createdAt: Date;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

export class FeedStoriesService {
  private static readonly COLLECTION_NAME = 'feedStories';
  private static readonly BATCH_SIZE = 5; // Reduced from 10 to avoid exhaustion
  private static readonly BATCH_DELAY = 500; // 500ms delay between batches

  /**
   * Get or create a unique story ID based on the feed and story URL
   */
  private static getStoryId(feedId: string, storyUrl: string): string {
    // Create a consistent ID based on feed and URL
    const cleanUrl = storyUrl.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 100);
    return `${feedId}_${cleanUrl}`;
  }

  /**
   * Check if a story already exists in the database
   */
  static async storyExists(feedId: string, storyUrl: string): Promise<boolean> {
    try {
      const storyId = this.getStoryId(feedId, storyUrl);
      const storyDoc = await getDoc(doc(db, this.COLLECTION_NAME, storyId));
      return storyDoc.exists();
    } catch (error) {
      console.error('Error checking if story exists:', error);
      return false;
    }
  }

  /**
   * Get the latest story timestamp for a feed
   */
  static async getLatestStoryTimestamp(feedId: string): Promise<Date | null> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('feedId', '==', feedId),
        orderBy('pubDate', 'desc'),
        limit(1)
      );
      
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const data = doc.data();
        return new Date(data.pubDate);
      }
      
      return null;
    } catch (error) {
      console.error('Error getting latest story timestamp:', error);
      return null;
    }
  }

  /**
   * Save multiple stories to the database
   */
  static async saveStories(
    feedId: string, 
    feedTitle: string, 
    feedType: 'rss' | 'twitter',
    stories: any[]
  ): Promise<{ saved: number; skipped: number }> {
    let saved = 0;
    let skipped = 0;
    
    try {
      // Process stories in batches
      for (let i = 0; i < stories.length; i += this.BATCH_SIZE) {
        const batch = writeBatch(db);
        const batchStories = stories.slice(i, i + this.BATCH_SIZE);
        let batchHasNewStories = false;
        
        for (const story of batchStories) {
          const storyUrl = story.link || story.url || '';
          if (!storyUrl) {
            skipped++;
            continue;
          }
          
          const storyId = this.getStoryId(feedId, storyUrl);
          const storyRef = doc(db, this.COLLECTION_NAME, storyId);
          
          // Check if story already exists
          const existingDoc = await getDoc(storyRef);
          if (existingDoc.exists()) {
            // Update lastSeenAt timestamp
            batch.update(storyRef, {
              lastSeenAt: new Date(),
              // Update metrics if available (for Twitter)
              ...(story.metrics && { metrics: story.metrics })
            });
            skipped++;
          } else {
            // Create new story
            // Parse and validate publication date
            let pubDateString = story.pubDate || story.createdAt || new Date().toISOString();
            let pubDate = new Date(pubDateString);
            const now = new Date();
            
            // If date is invalid or in the future, use current date
            if (isNaN(pubDate.getTime()) || pubDate > now) {
              if (pubDate > now) {
                console.warn(`Future date detected for story "${story.title}" (${pubDateString}) - using current date`);
              }
              pubDateString = now.toISOString();
            }
            
            const storyData: FeedStory = {
              id: storyId,
              feedId,
              feedTitle,
              feedType,
              title: story.title || story.text?.substring(0, 100) || 'Untitled',
              link: storyUrl,
              contentSnippet: story.contentSnippet || story.text,
              description: story.description || story.contentSnippet || story.text,
              pubDate: pubDateString,
              guid: story.guid || storyUrl,
              categories: story.categories || [],
              thumbnail: story.thumbnail,
              media: story.media,
              metrics: story.metrics,
              createdAt: new Date(),
              firstSeenAt: new Date(),
              lastSeenAt: new Date()
            };
            
            batch.set(storyRef, cleanFirestoreData(storyData));
            batchHasNewStories = true;
            saved++;
          }
        }
        
        // Only commit if there are changes
        if (batchHasNewStories || skipped > 0) {
          await batch.commit();
        }
        
        // Add delay between batches to avoid rate limiting
        if (i + this.BATCH_SIZE < stories.length) {
          await new Promise(resolve => setTimeout(resolve, this.BATCH_DELAY));
        }
      }
      
      activityLog.info(`Feed stories saved: ${saved} new, ${skipped} existing for ${feedTitle}`);
      return { saved, skipped };
      
    } catch (error) {
      console.error('Error saving feed stories:', error);
      activityLog.error(`Failed to save feed stories: ${error}`);
      throw error;
    }
  }

  /**
   * Get stories for a specific feed
   */
  static async getFeedStories(
    feedId: string, 
    limitCount: number = 50,
    startAfterDate?: Date
  ): Promise<FeedStory[]> {
    try {
      let q = query(
        collection(db, this.COLLECTION_NAME),
        where('feedId', '==', feedId),
        orderBy('pubDate', 'desc'),
        limit(limitCount)
      );
      
      if (startAfterDate) {
        q = query(
          collection(db, this.COLLECTION_NAME),
          where('feedId', '==', feedId),
          where('pubDate', '<', startAfterDate.toISOString()),
          orderBy('pubDate', 'desc'),
          limit(limitCount)
        );
      }
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as FeedStory);
      
    } catch (error) {
      console.error('Error getting feed stories:', error);
      return [];
    }
  }

  /**
   * Get all stories across all feeds
   */
  static async getAllStories(
    limitCount: number = 100,
    feedType?: 'rss' | 'twitter'
  ): Promise<FeedStory[]> {
    try {
      let q = query(
        collection(db, this.COLLECTION_NAME),
        orderBy('pubDate', 'desc'),
        limit(limitCount)
      );
      
      if (feedType) {
        q = query(
          collection(db, this.COLLECTION_NAME),
          where('feedType', '==', feedType),
          orderBy('pubDate', 'desc'),
          limit(limitCount)
        );
      }
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as FeedStory);
      
    } catch (error) {
      console.error('Error getting all stories:', error);
      return [];
    }
  }

  /**
   * Search stories by text
   */
  static async searchStories(searchText: string, limitCount: number = 50): Promise<FeedStory[]> {
    try {
      // Note: This is a simple implementation. For better search,
      // consider using Algolia or Elasticsearch
      const allStories = await this.getAllStories(200);
      
      const searchLower = searchText.toLowerCase();
      const filtered = allStories.filter(story => 
        story.title.toLowerCase().includes(searchLower) ||
        story.description?.toLowerCase().includes(searchLower) ||
        story.contentSnippet?.toLowerCase().includes(searchLower)
      );
      
      return filtered.slice(0, limitCount);
      
    } catch (error) {
      console.error('Error searching stories:', error);
      return [];
    }
  }

  /**
   * Delete old stories (cleanup function)
   */
  static async deleteOldStories(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('firstSeenAt', '<', cutoffDate),
        limit(500) // Process in chunks
      );
      
      const snapshot = await getDocs(q);
      let deleted = 0;
      
      // Delete in batches
      const batch = writeBatch(db);
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        deleted++;
      });
      
      if (deleted > 0) {
        await batch.commit();
        activityLog.info(`Deleted ${deleted} old feed stories`);
      }
      
      return deleted;
      
    } catch (error) {
      console.error('Error deleting old stories:', error);
      return 0;
    }
  }
}