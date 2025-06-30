import { collection, getDocs, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cleanFirestoreData } from '@/lib/utils/firebaseHelpers';

interface FeedHealth {
  id: string;
  title: string;
  url: string;
  type?: string;
  lastError?: string;
  errorCount: number;
  lastFetched?: Date;
  lastSuccessfulFetch?: Date;
  isDead: boolean;
  reason?: string;
  suggestedType?: 'youtube' | 'twitter' | 'rss' | 'googlenews';
  detectedPlatform?: string;
}

export class FeedHealthService {
  // Consider a feed dead if it has failed 5+ times or hasn't worked in 30 days
  static readonly ERROR_THRESHOLD = 5;
  static readonly DAYS_THRESHOLD = 30;

  /**
   * Detect the actual platform type from a URL
   */
  static detectFeedType(url: string): { suggestedType?: 'youtube' | 'twitter' | 'rss' | 'googlenews'; detectedPlatform?: string } {
    if (!url) return {};

    const lowerUrl = url.toLowerCase();

    // YouTube detection
    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
      // Check if it's a YouTube RSS feed URL
      if (lowerUrl.includes('feeds.videos.xml') || lowerUrl.includes('channel_id=')) {
        return { suggestedType: 'youtube', detectedPlatform: 'YouTube Channel RSS' };
      }
      return { suggestedType: 'youtube', detectedPlatform: 'YouTube' };
    }

    // Twitter/X detection
    if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com') || lowerUrl.includes('nitter')) {
      return { suggestedType: 'twitter', detectedPlatform: 'Twitter/X' };
    }

    // Google News detection
    if (lowerUrl.includes('news.google.com')) {
      return { suggestedType: 'googlenews', detectedPlatform: 'Google News' };
    }

    // RSS feed detection (default)
    if (lowerUrl.includes('.xml') || lowerUrl.includes('/feed') || lowerUrl.includes('/rss')) {
      return { suggestedType: 'rss', detectedPlatform: 'RSS Feed' };
    }

    return {};
  }

  /**
   * Check all feeds and identify dead or problematic ones
   */
  static async checkFeedHealth(): Promise<{
    healthy: FeedHealth[];
    problematic: FeedHealth[];
    dead: FeedHealth[];
  }> {
    try {
      const feedsSnapshot = await getDocs(collection(db, 'rssFeeds'));
      const feeds = feedsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const healthy: FeedHealth[] = [];
      const problematic: FeedHealth[] = [];
      const dead: FeedHealth[] = [];

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

      feeds.forEach(feed => {
        const errorCount = feed.errorCount || 0;
        const lastSuccessfulFetch = feed.lastSuccessfulFetch?.toDate?.() || feed.lastSuccessfulFetch;
        const lastFetched = feed.lastFetched?.toDate?.() || feed.lastFetched;
        
        // Detect if the feed type might be wrong
        const feedUrl = feed.url || '';
        const typeDetection = this.detectFeedType(feedUrl);
        
        const feedHealth: FeedHealth = {
          id: feed.id,
          title: feed.title,
          url: feed.url || feed.googleNewsQuery || feed.twitterUsername || '',
          type: feed.type,
          lastError: feed.lastError,
          errorCount: errorCount,
          lastFetched: lastFetched,
          lastSuccessfulFetch: lastSuccessfulFetch,
          isDead: false,
          reason: undefined,
          ...(typeDetection.suggestedType && typeDetection.suggestedType !== feed.type ? typeDetection : {})
        };

        // Determine health status
        if (errorCount >= this.ERROR_THRESHOLD) {
          feedHealth.isDead = true;
          feedHealth.reason = `Failed ${errorCount} times`;
          dead.push(feedHealth);
        } else if (lastSuccessfulFetch && lastSuccessfulFetch < thirtyDaysAgo) {
          feedHealth.isDead = true;
          feedHealth.reason = 'No successful fetch in 30+ days';
          dead.push(feedHealth);
        } else if (!lastFetched && feed.createdAt?.toDate?.() < thirtyDaysAgo) {
          feedHealth.isDead = true;
          feedHealth.reason = 'Never fetched successfully';
          dead.push(feedHealth);
        } else if (errorCount > 0) {
          problematic.push(feedHealth);
        } else {
          healthy.push(feedHealth);
        }
      });

      return { healthy, problematic, dead };
    } catch (error) {
      console.error('Error checking feed health:', error);
      throw error;
    }
  }

  /**
   * Remove dead feeds in batches
   */
  static async removeDeadFeeds(feedIds: string[]): Promise<number> {
    if (feedIds.length === 0) return 0;

    try {
      let deletedCount = 0;
      const BATCH_SIZE = 100; // Firestore batch limit

      for (let i = 0; i < feedIds.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const batchIds = feedIds.slice(i, Math.min(i + BATCH_SIZE, feedIds.length));

        batchIds.forEach(feedId => {
          const feedRef = doc(db, 'rssFeeds', feedId);
          batch.delete(feedRef);
        });

        await batch.commit();
        deletedCount += batchIds.length;
      }

      return deletedCount;
    } catch (error) {
      console.error('Error removing dead feeds:', error);
      throw error;
    }
  }

  /**
   * Reset error count for a feed (useful after fixing issues)
   */
  static async resetFeedErrors(feedId: string): Promise<void> {
    try {
      const feedRef = doc(db, 'rssFeeds', feedId);
      await updateDoc(feedRef, cleanFirestoreData({
        errorCount: 0,
        lastError: null
      }));
    } catch (error) {
      console.error('Error resetting feed errors:', error);
      throw error;
    }
  }

  /**
   * Mark feed fetch as successful
   */
  static async markFeedSuccess(feedId: string): Promise<void> {
    try {
      const feedRef = doc(db, 'rssFeeds', feedId);
      
      // Check if document exists first
      const feedSnapshot = await getDocs(collection(db, 'rssFeeds'));
      const feedDoc = feedSnapshot.docs.find(doc => doc.id === feedId);
      
      if (!feedDoc) {
        console.warn(`Feed document ${feedId} not found, skipping success tracking`);
        return;
      }
      
      await updateDoc(feedRef, cleanFirestoreData({
        lastSuccessfulFetch: new Date(),
        errorCount: 0,
        lastError: null
      }));
    } catch (error) {
      // Silently fail for success tracking to avoid cascading errors
      console.warn('Error marking feed success:', error);
    }
  }

  /**
   * Mark feed fetch as failed
   */
  static async markFeedError(feedId: string, error: string): Promise<void> {
    try {
      const feedRef = doc(db, 'rssFeeds', feedId);
      
      // Get current error count
      const feedSnapshot = await getDocs(collection(db, 'rssFeeds'));
      const feedDoc = feedSnapshot.docs.find(doc => doc.id === feedId);
      
      // Check if document exists
      if (!feedDoc) {
        console.warn(`Feed document ${feedId} not found, skipping error tracking`);
        return;
      }
      
      const currentErrorCount = feedDoc.data()?.errorCount || 0;
      
      await updateDoc(feedRef, cleanFirestoreData({
        lastError: error,
        errorCount: currentErrorCount + 1,
        lastFetched: new Date()
      }));
    } catch (error) {
      // Silently fail for error tracking to avoid cascading errors
      console.warn('Error marking feed error:', error);
    }
  }

  /**
   * Convert a feed to a different type (e.g., RSS to YouTube)
   */
  static async convertFeedType(feedId: string, newType: 'youtube' | 'twitter' | 'rss' | 'googlenews'): Promise<void> {
    try {
      const feedRef = doc(db, 'rssFeeds', feedId);
      
      // Get current feed data
      const feedSnapshot = await getDocs(collection(db, 'rssFeeds'));
      const feedDoc = feedSnapshot.docs.find(doc => doc.id === feedId);
      
      if (!feedDoc) {
        throw new Error(`Feed ${feedId} not found`);
      }
      
      const feedData = feedDoc.data();
      const updates: any = {
        type: newType,
        errorCount: 0, // Reset errors on conversion
        lastError: null
      };
      
      // Handle YouTube conversion
      if (newType === 'youtube' && feedData.url) {
        // Extract channel ID from YouTube RSS feed URL
        const channelIdMatch = feedData.url.match(/channel_id=([^&]+)/);
        if (channelIdMatch) {
          updates.youtubeUrl = `https://www.youtube.com/channel/${channelIdMatch[1]}`;
        } else {
          updates.youtubeUrl = feedData.url; // Use original URL as fallback
        }
      }
      
      // Handle Twitter conversion
      if (newType === 'twitter' && feedData.title) {
        // Try to extract username from title or URL
        updates.twitterUsername = feedData.title.replace(/^@/, '');
      }
      
      await updateDoc(feedRef, cleanFirestoreData(updates));
    } catch (error) {
      console.error('Error converting feed type:', error);
      throw error;
    }
  }
}