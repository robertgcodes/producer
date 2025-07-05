import { adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import Parser from 'rss-parser';
import { feedHealthBatcherServer } from './feedHealthBatcher.server';
import { v4 as uuidv4 } from 'uuid';
import { cleanFirestoreData } from '@/lib/utils/firebaseHelpers';

// Use the same parser configuration
const parser = new Parser({
  timeout: 30000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; WatcherPro/1.0)',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*'
  },
  customFields: {
    item: [
      ['media:content', 'media:content', {keepArray: true}],
      ['media:thumbnail', 'media:thumbnail'],
      ['enclosure', 'enclosure'],
      ['description', 'description'],
      ['content:encoded', 'content:encoded'],
      ['dc:creator', 'creator'],
      ['author', 'author']
    ]
  }
});

export class RSSServiceServer {
  static async fetchFeed(url: string): Promise<any> {
    try {
      if (!url || url === '/api/rss') {
        throw new Error('Invalid feed URL');
      }

      const feed = await parser.parseURL(url);
      return {
        title: feed.title || '',
        description: feed.description || '',
        link: feed.link || '',
        items: (feed.items || []).map(item => ({
          title: item.title || '',
          link: item.link || '',
          pubDate: item.pubDate || item.isoDate || '',
          creator: item.creator || item.author || '',
          contentSnippet: item.contentSnippet || '',
          content: item.content || item['content:encoded'] || '',
          guid: item.guid || item.link || '',
          categories: item.categories || [],
          enclosure: item.enclosure || null,
          media: item['media:content'] || item['media:thumbnail'] || null
        }))
      };
    } catch (error) {
      throw error;
    }
  }

  static async refreshFeed(feedId: string, feedUrl: string): Promise<{ feedData: any; itemCount: number }> {
    try {
      const feedData = await this.fetchFeed(feedUrl);
      const itemCount = await this.updateFeedItems(feedId, feedData);
      return { feedData, itemCount };
    } catch (error) {
      feedHealthBatcherServer.queueError(feedId, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  static async updateFeedItems(feedId: string, feedData: any): Promise<number> {
    if (!feedData.items || feedData.items.length === 0) {
      feedHealthBatcherServer.queueSuccess(feedId);
      return 0;
    }

    try {
      let newItemCount = 0;
      const batch = adminDb.batch();
      let operationCount = 0;
      
      // Get existing items to check for duplicates
      const existingItemsSnapshot = await adminDb
        .collection('feedItems')
        .where('feedId', '==', feedId)
        .get();
      
      const existingGuids = new Set(
        existingItemsSnapshot.docs.map(doc => doc.data().guid)
      );

      for (const item of feedData.items) {
        const guid = item.guid || item.link;
        
        if (!guid || existingGuids.has(guid)) {
          continue;
        }

        const itemId = uuidv4();
        const feedItemRef = adminDb.collection('feedItems').doc(itemId);
        
        let pubDate = new Date();
        if (item.pubDate) {
          const parsed = new Date(item.pubDate);
          if (!isNaN(parsed.getTime())) {
            pubDate = parsed;
          }
        }

        const feedItem = cleanFirestoreData({
          feedId,
          guid,
          title: item.title || 'Untitled',
          link: item.link || '',
          pubDate: Timestamp.fromDate(pubDate),
          contentSnippet: item.contentSnippet || item.content?.substring(0, 200) || '',
          creator: item.creator || '',
          categories: item.categories || [],
          thumbnail: this.extractThumbnail(item),
          createdAt: Timestamp.now(),
          indexed: true
        });

        batch.set(feedItemRef, feedItem);
        newItemCount++;
        operationCount++;

        // Commit batch if we hit Firestore limit
        if (operationCount >= 400) {
          await batch.commit();
          operationCount = 0;
        }
      }

      // Commit any remaining operations
      if (operationCount > 0) {
        await batch.commit();
      }

      // Update feed metadata
      await adminDb.collection('rssFeeds').doc(feedId).update({
        lastRefreshed: Timestamp.now(),
        lastFetched: Timestamp.now(), // Update lastFetched so UI shows correct time
        itemCount: existingItemsSnapshot.size + newItemCount
      });

      // Note: Bundle matching is handled separately by the client-side services
      // The server-side cron job focuses on storing feed items in Firestore

      feedHealthBatcherServer.queueSuccess(feedId);
      return newItemCount;
    } catch (error) {
      feedHealthBatcherServer.queueError(feedId, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  private static extractThumbnail(item: any): string | null {
    if (item.media) {
      if (Array.isArray(item.media)) {
        const image = item.media.find((m: any) => m.$ && m.$.medium === 'image');
        if (image && image.$ && image.$.url) {
          return image.$.url;
        }
      } else if (item.media.$ && item.media.$.url) {
        return item.media.$.url;
      }
    }

    if (item.enclosure && item.enclosure.url && item.enclosure.type?.startsWith('image/')) {
      return item.enclosure.url;
    }

    const imgMatch = item.content?.match(/<img[^>]+src=["']([^"']+)["']/);
    if (imgMatch && imgMatch[1]) {
      return imgMatch[1];
    }

    return null;
  }
}