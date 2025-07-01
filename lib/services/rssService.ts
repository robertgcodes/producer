import { collection, doc, updateDoc, setDoc, getDocs, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cleanFirestoreData } from '@/lib/utils/firebaseHelpers';
import { feedHealthBatcher } from './feedHealthBatcher';
import { BundleItemsService } from './bundleItemsService';
import { activityLog } from './activityLogService';
import { FeedStoriesService } from './feedStoriesService';

interface RSSItem {
  title: string;
  link: string;
  pubDate?: string;
  contentSnippet?: string;
  content?: string;
  creator?: string;
  categories?: string[];
  guid?: string;
  mediaContent?: any[];
  mediaThumbnail?: any;
  thumbnail?: string;
}

interface FeedData {
  title: string;
  description: string;
  link: string;
  lastBuildDate: string;
  items: RSSItem[];
}

export class RSSService {
  static async fetchFeed(url: string): Promise<FeedData> {
    const response = await fetch('/api/rss', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch RSS feed');
    }

    return response.json();
  }

  static async updateFeedItems(feedId: string, feedData: FeedData): Promise<number> {
    try {
      // Get feed details first
      const feedDoc = await getDoc(doc(db, 'rssFeeds', feedId));
      if (!feedDoc.exists()) {
        throw new Error('Feed not found');
      }
      
      const feedInfo = feedDoc.data();
      const feedTitle = feedInfo.title || feedData.title || 'Unknown Feed';
      
      // Process items to extract thumbnails
      const processedItems = feedData.items.map(item => {
        let thumbnail = item.thumbnail;
        
        // Extract thumbnail from various sources
        if (!thumbnail && item.mediaThumbnail) {
          thumbnail = item.mediaThumbnail.url || item.mediaThumbnail.$ && item.mediaThumbnail.$.url;
        }
        
        if (!thumbnail && item.mediaContent && item.mediaContent.length > 0) {
          const media = item.mediaContent[0];
          if (media.$ && media.$.url && (media.$.medium === 'image' || media.$.type && media.$.type.startsWith('image/'))) {
            thumbnail = media.$.url;
          }
        }
        
        // Extract thumbnail from content if available
        if (!thumbnail && item.content) {
          const imgMatch = item.content.match(/<img[^>]+src=["']([^"']+)["']/i);
          if (imgMatch) {
            thumbnail = imgMatch[1];
          }
        }
        
        // Only include thumbnail if it exists
        const processedItem: any = { ...item };
        if (thumbnail) {
          processedItem.thumbnail = thumbnail;
        }
        return processedItem;
      });
      
      // Save stories to permanent collection and get new stories
      const { saved, skipped } = await FeedStoriesService.saveStories(
        feedId,
        feedTitle,
        'rss',
        processedItems
      );
      
      activityLog.info(`RSS feed ${feedTitle}: ${saved} new stories, ${skipped} existing`);
      
      // Get the latest stories from the permanent collection for display
      const latestStories = await FeedStoriesService.getFeedStories(feedId, 50);
      
      // Update the feed document with the latest stories
      const feedRef = doc(db, 'rssFeeds', feedId);
      const updateData: any = {
        items: latestStories.map(story => ({
          title: story.title,
          link: story.link,
          pubDate: story.pubDate,
          contentSnippet: story.contentSnippet,
          content: story.description,
          categories: story.categories,
          guid: story.guid || story.link,
          thumbnail: story.thumbnail
        })),
        lastFetched: new Date(),
      };
      
      // Only add fields if they are defined
      if (feedData.lastBuildDate !== undefined) updateData.lastBuildDate = feedData.lastBuildDate;
      if (feedData.title !== undefined) updateData.feedTitle = feedData.title;
      if (feedData.description !== undefined) updateData.feedDescription = feedData.description;
      if (feedData.link !== undefined) updateData.feedLink = feedData.link;
      
      await updateDoc(feedRef, cleanFirestoreData(updateData));

      // Only process NEW items for bundle matching
      if (saved > 0) {
        const newItems = processedItems.slice(0, saved);
        console.log(`Processing ${newItems.length} NEW items for bundle matching from ${feedTitle}`);
        
        for (const item of newItems) {
          await BundleItemsService.processFeedItemForBundles(feedId, feedTitle, 'rss', item);
        }
      }
      
      // Return the number of new items processed
      return saved;
    } catch (error) {
      console.error('Error updating feed items:', error);
      throw error;
    }
  }

  static async refreshFeed(feedId: string, feedUrl: string): Promise<{ feedData: FeedData; itemCount: number }> {
    try {
      const feedData = await this.fetchFeed(feedUrl);
      const itemCount = await this.updateFeedItems(feedId, feedData);
      // Queue success update (batched)
      feedHealthBatcher.queueSuccess(feedId);
      return { feedData, itemCount };
    } catch (error) {
      // Queue error update (batched)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      feedHealthBatcher.queueError(feedId, errorMessage);
      throw error;
    }
  }

  static async refreshAllFeeds() {
    try {
      const feedsSnapshot = await getDocs(collection(db, 'rssFeeds'));
      const feeds = feedsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Array<{id: string; url: string; title: string; type?: string; twitterUsername?: string}>;

      const promises = feeds.map(async (feed) => {
        try {
          // Skip Twitter feeds - they should be refreshed by TwitterService
          if (feed.type === 'twitter') {
            console.log(`Skipping Twitter feed ${feed.title} in RSS refresh`);
            return Promise.resolve();
          }
          
          // Skip feeds without valid URLs
          if (!feed.url) {
            console.error(`Feed ${feed.title} has no URL`);
            return Promise.resolve();
          }
          
          return await this.refreshFeed(feed.id, feed.url);
        } catch (error) {
          console.error(`Failed to refresh feed ${feed.title}:`, error);
          // Don't throw, just log the error so other feeds can continue
        }
      });

      await Promise.all(promises);
    } catch (error) {
      console.error('Error refreshing all feeds:', error);
    }
  }
}