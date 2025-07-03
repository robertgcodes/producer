import { adminDb } from '@/lib/firebase-admin';
import { RSSServiceServer } from './rssService.server';
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

export class FeedRefreshServiceServer {
  static async refreshSpecificFeeds(
    feedIds: string[], 
    onProgress?: (current: number, total: number) => void
  ) {
    try {
      const feedsSnapshot = await adminDb.collection('rssFeeds').get();
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
      const BATCH_SIZE = 2;
      const DELAY_BETWEEN_BATCHES = 3000;
      
      for (let i = 0; i < feeds.length; i += BATCH_SIZE) {
        const batch = feeds.slice(i, i + BATCH_SIZE);
        
        // Process batch in parallel
        const results = await Promise.allSettled(
          batch.map(async (feed) => {
            try {
              let feedItemCount = 0;
              
              switch (feed.type) {
                case 'twitter':
                  if (feed.twitterUsername) {
                    feedItemCount = await TwitterService.refreshTwitterFeed(feed.id, feed.twitterUsername);
                  }
                  break;
                  
                case 'youtube':
                  if (feed.url) {
                    // YouTube feeds use RSS under the hood
                    const result = await RSSServiceServer.refreshFeed(feed.id, feed.url);
                    feedItemCount = result.itemCount;
                  }
                  break;
                  
                case 'googlenews':
                  if (feed.url) {
                    // Google News feeds also use RSS
                    const result = await RSSServiceServer.refreshFeed(feed.id, feed.url);
                    feedItemCount = result.itemCount;
                  }
                  break;
                  
                case 'rss':
                default:
                  const result = await RSSServiceServer.refreshFeed(feed.id, feed.url);
                  feedItemCount = result.itemCount;
                  break;
              }
              
              activityLog.info(`Successfully refreshed: ${feed.title} (${feedItemCount} items)`);
              return { success: true, feed, itemCount: feedItemCount };
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              activityLog.error(`Failed to refresh ${feed.title}: ${errorMessage}`);
              return { success: false, feed, error: errorMessage };
            }
          })
        );
        
        // Count results
        results.forEach((result, index) => {
          processedCount++;
          if (onProgress) {
            onProgress(processedCount, feeds.length);
          }
          
          if (result.status === 'fulfilled' && result.value.success) {
            successCount++;
          } else {
            failedCount++;
            const feed = batch[index];
            const error = result.status === 'rejected' 
              ? result.reason?.message || 'Unknown error'
              : result.value.error;
            failedFeeds.push({
              title: feed.title,
              error: error
            });
          }
        });
        
        // Add delay between batches if not the last batch
        if (i + BATCH_SIZE < feeds.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        }
      }

      activityLog.info(`Refresh completed: ${successCount} success, ${failedCount} failed`);
      
      return {
        successCount,
        failedCount,
        failedFeeds
      };
    } catch (error) {
      activityLog.error(`Feed refresh service error: ${error}`);
      throw error;
    }
  }
}