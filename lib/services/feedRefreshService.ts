import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RSSService } from './rssService';
import { TwitterService } from './twitterService';
import { YouTubeService } from './youtubeService';
import { GoogleNewsService } from './googleNewsService';
import { activityLog } from './activityLogService';

interface Feed {
  id: string;
  url: string;
  title: string;
  type?: 'rss' | 'twitter' | 'youtube' | 'googlenews';
  twitterUsername?: string;
  youtubeUrl?: string;
  googleNewsQuery?: string;
  freshnessFilter?: number;
}

export class FeedRefreshService {
  static async refreshSpecificFeeds(
    feedIds: string[], 
    onProgress?: (current: number, total: number) => void
  ) {
    try {
      const feedsSnapshot = await getDocs(collection(db, 'rssFeeds'));
      const allFeeds = feedsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Feed[];
      
      // Filter to only the specified feed IDs
      const feeds = allFeeds.filter(feed => feedIds.includes(feed.id));
      
      if (feeds.length === 0) {
        return { successCount: 0, failedCount: 0, failedFeeds: [] };
      }
      
      activityLog.info(`Starting refresh for ${feeds.length} selected feeds`);

      let successCount = 0;
      let failedCount = 0;
      const failedFeeds: { title: string; error: string }[] = [];
      let processedCount = 0;

      // Process feeds in batches to avoid overloading Firebase
      const BATCH_SIZE = 2; // Further reduced to avoid write stream exhaustion
      const DELAY_BETWEEN_BATCHES = 3000; // 3 second delay
      
      for (let i = 0; i < feeds.length; i += BATCH_SIZE) {
        const batch = feeds.slice(i, i + BATCH_SIZE);
        
        const batchPromises = batch.map(async (feed) => {
          try {
            // Skip feeds without valid data
            if (feed.type === 'twitter' && !feed.twitterUsername) {
              console.warn(`Twitter feed ${feed.title} has no username`);
              activityLog.warning(`Skipping Twitter feed ${feed.title} - no username`);
              return;
            }
            
            activityLog.startFeedRefresh(feed.title, feed.id);
            
            let itemCount = 0;
            
            if (feed.type === 'twitter' && feed.twitterUsername) {
              // Refresh Twitter feed
              itemCount = await TwitterService.refreshTwitterFeed(feed.id, feed.twitterUsername);
            } else if (feed.type === 'youtube' && feed.url) {
              // Refresh YouTube feed using RSS service (YouTube provides RSS feeds)
              const feedData = await YouTubeService.fetchYouTubeFeed(feed.url);
              itemCount = await RSSService.updateFeedItems(feed.id, feedData);
            } else if (feed.type === 'googlenews' && feed.googleNewsQuery) {
              // Refresh Google News feed with time filter
              const when = feed.freshnessFilter ? GoogleNewsService.daysToGoogleWhen(feed.freshnessFilter) : undefined;
              const feedData = await GoogleNewsService.getGoogleNewsFeed(feed.googleNewsQuery, { when });
              itemCount = await RSSService.updateFeedItems(feed.id, feedData);
            } else if (feed.url) {
              // Refresh regular RSS feed
              const result = await RSSService.refreshFeed(feed.id, feed.url);
              itemCount = result.itemCount;
            } else {
              console.warn(`Feed ${feed.title} (${feed.id}) has no valid URL or username`);
              activityLog.warning(`Skipping feed ${feed.title} - no valid URL or username`);
              return;
            }
            successCount++;
            activityLog.completeFeedRefresh(feed.title, feed.id, itemCount);
          } catch (error) {
            failedCount++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            failedFeeds.push({ title: feed.title, error: errorMessage });
            console.error(`Failed to refresh feed ${feed.title}:`, errorMessage);
            activityLog.errorFeedRefresh(feed.title, feed.id, errorMessage);
            // Don't throw, just log the error so other feeds can continue
          } finally {
            processedCount++;
            if (onProgress) {
              onProgress(processedCount, feeds.length);
              activityLog.progress(`Refreshing feeds`, processedCount, feeds.length);
            }
          }
        });

        await Promise.all(batchPromises);
        
        // Add delay between batches if not the last batch
        if (i + BATCH_SIZE < feeds.length) {
          console.log(`Processed batch ${Math.floor(i / BATCH_SIZE) + 1}, waiting before next batch...`);
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        }
      }
      
      // Log summary
      console.log(`Feed refresh complete: ${successCount} succeeded, ${failedCount} failed`);
      if (failedFeeds.length > 0) {
        console.log('Failed feeds:', failedFeeds);
      }
      
      activityLog.success(`Feed refresh complete: ${successCount} succeeded, ${failedCount} failed`);
      
      return { successCount, failedCount, failedFeeds };
    } catch (error) {
      console.error('Error refreshing specific feeds:', error);
      throw error;
    }
  }
  
  static async refreshAllFeeds(includeTwitter: boolean = true) {
    try {
      const feedsSnapshot = await getDocs(collection(db, 'rssFeeds'));
      const feeds = feedsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Feed[];

      let successCount = 0;
      let failedCount = 0;
      const failedFeeds: { title: string; error: string }[] = [];

      // Process feeds in batches to avoid overloading Firebase
      const BATCH_SIZE = 2; // Further reduced to avoid write stream exhaustion
      const DELAY_BETWEEN_BATCHES = 3000; // 3 second delay
      
      for (let i = 0; i < feeds.length; i += BATCH_SIZE) {
        const batch = feeds.slice(i, i + BATCH_SIZE);
        
        const batchPromises = batch.map(async (feed) => {
          try {
            if (feed.type === 'twitter' && feed.twitterUsername) {
              // Skip Twitter feeds if includeTwitter is false
              if (!includeTwitter) {
                console.log(`Skipping Twitter feed ${feed.title} in auto-refresh`);
                return;
              }
              // Refresh Twitter feed
              await TwitterService.refreshTwitterFeed(feed.id, feed.twitterUsername);
            } else if (feed.type === 'youtube' && feed.url) {
              // Refresh YouTube feed using RSS service (YouTube provides RSS feeds)
              const feedData = await YouTubeService.fetchYouTubeFeed(feed.url);
              await RSSService.updateFeedItems(feed.id, feedData);
            } else if (feed.type === 'googlenews' && feed.googleNewsQuery) {
              // Refresh Google News feed with time filter
              const when = feed.freshnessFilter ? GoogleNewsService.daysToGoogleWhen(feed.freshnessFilter) : undefined;
              const feedData = await GoogleNewsService.getGoogleNewsFeed(feed.googleNewsQuery, { when });
              await RSSService.updateFeedItems(feed.id, feedData);
            } else if (feed.url) {
              // Refresh regular RSS feed
              await RSSService.refreshFeed(feed.id, feed.url);
            } else {
              console.warn(`Feed ${feed.title} (${feed.id}) has no valid URL or username`);
              activityLog.warning(`Skipping feed ${feed.title} - no valid URL or username`);
              return;
            }
            successCount++;
            activityLog.completeFeedRefresh(feed.title, feed.id, 0); // TODO: Add item count
          } catch (error) {
            failedCount++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            failedFeeds.push({ title: feed.title, error: errorMessage });
            console.error(`Failed to refresh feed ${feed.title}:`, errorMessage);
            activityLog.errorFeedRefresh(feed.title, feed.id, errorMessage);
            // Don't throw, just log the error so other feeds can continue
          }
        });

        await Promise.all(batchPromises);
        
        // Add delay between batches if not the last batch
        if (i + BATCH_SIZE < feeds.length) {
          console.log(`Processed batch ${Math.floor(i / BATCH_SIZE) + 1}, waiting before next batch...`);
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        }
      }
      
      // Log summary
      console.log(`Feed refresh complete: ${successCount} succeeded, ${failedCount} failed`);
      if (failedFeeds.length > 0) {
        console.log('Failed feeds:', failedFeeds);
      }
      
      activityLog.success(`Feed refresh complete: ${successCount} succeeded, ${failedCount} failed`);
      
      return { successCount, failedCount, failedFeeds };
    } catch (error) {
      console.error('Error refreshing all feeds:', error);
      throw error;
    }
  }

  static async refreshFeed(feedId: string) {
    try {
      const feedsSnapshot = await getDocs(collection(db, 'rssFeeds'));
      const feedDoc = feedsSnapshot.docs.find(doc => doc.id === feedId);
      
      if (!feedDoc) {
        throw new Error('Feed not found');
      }

      const feed = {
        id: feedDoc.id,
        ...feedDoc.data()
      } as Feed;

      if (feed.type === 'twitter' && feed.twitterUsername) {
        await TwitterService.refreshTwitterFeed(feed.id, feed.twitterUsername);
      } else if (feed.type === 'youtube' && feed.url) {
        const feedData = await YouTubeService.fetchYouTubeFeed(feed.url);
        await RSSService.updateFeedItems(feed.id, feedData);
      } else if (feed.type === 'googlenews' && feed.googleNewsQuery) {
        const when = feed.freshnessFilter ? GoogleNewsService.daysToGoogleWhen(feed.freshnessFilter) : undefined;
        const feedData = await GoogleNewsService.getGoogleNewsFeed(feed.googleNewsQuery, { when });
        await RSSService.updateFeedItems(feed.id, feedData);
      } else if (feed.url) {
        await RSSService.refreshFeed(feed.id, feed.url);
      } else {
        throw new Error('Feed has no valid URL or username');
      }
    } catch (error) {
      console.error(`Error refreshing feed ${feedId}:`, error);
      throw error;
    }
  }
  
  static async refreshNonTwitterFeeds() {
    // Convenience method for auto-refresh that excludes Twitter feeds
    return this.refreshAllFeeds(false);
  }
}