import { doc, updateDoc, collection, setDoc, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cleanFirestoreData } from '@/lib/utils/firebaseHelpers';
import { BundleItemsService } from './bundleItemsService';
import { activityLog } from './activityLogService';
import { FeedStoriesService } from './feedStoriesService';

export interface TwitterFeedData {
  tweets: Tweet[];
  username: string;
}

export interface Tweet {
  id: string;
  text: string;
  createdAt: string;
  metrics?: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
  };
  url: string;
  entities?: any;
  media?: Array<{
    type: string;
    url: string;
    width?: number;
    height?: number;
    altText?: string;
  }>;
}

export class TwitterService {
  static async fetchTwitterFeed(username: string): Promise<TwitterFeedData> {
    try {
      activityLog.info(`Fetching Twitter feed for @${username}`);
      
      // Try Apify first to avoid rate limits
      const apifyResponse = await fetch(`/api/twitter-apify?username=${encodeURIComponent(username)}&count=20`);
      
      if (apifyResponse.ok) {
        const data = await apifyResponse.json();
        activityLog.info(`Received ${data.tweets?.length || 0} tweets from Apify for @${username}`);
        console.log(`Twitter API response for @${username}:`, data);
        return data;
      }
      
      // If Apify fails, try official Twitter API as fallback (but not if we're rate limited)
      if (apifyResponse.status !== 429) {
        try {
          const response = await fetch(`/api/twitter?username=${encodeURIComponent(username)}&count=20`);
          
          if (response.ok) {
            const data = await response.json();
            activityLog.info(`Received ${data.tweets?.length || 0} tweets from Twitter API for @${username}`);
            console.log(`Twitter API response for @${username}:`, data);
            return data;
          }
        } catch (officialApiError) {
          console.log('Official Twitter API also failed:', officialApiError);
        }
      }
      
      // If both fail, log the error
      let errorMessage = 'Failed to fetch Twitter feed';
      try {
        const error = await apifyResponse.json();
        errorMessage = typeof error.error === 'object' ? JSON.stringify(error.error) : (error.error || errorMessage);
      } catch (e) {
        errorMessage = `HTTP ${apifyResponse.status}: ${apifyResponse.statusText}`;
      }
      activityLog.error(`Failed to fetch Twitter feed for @${username}: ${errorMessage}`);
      throw new Error(errorMessage);
    } catch (error) {
      console.error('Error fetching Twitter feed:', error);
      throw error;
    }
  }
  
  static async updateTwitterFeedItems(feedId: string, username: string): Promise<number> {
    try {
      const feedData = await this.fetchTwitterFeed(username);
      
      // Check if we got any tweets
      if (!feedData.tweets || feedData.tweets.length === 0) {
        activityLog.warning(`No tweets returned for @${username}`);
        console.warn(`No tweets returned for @${username}. Response:`, feedData);
        return 0;
      }
      
      // Get feed details first
      const feedDoc = await getDoc(doc(db, 'rssFeeds', feedId));
      if (!feedDoc.exists()) {
        throw new Error('Feed not found');
      }
      
      const feedInfo = feedDoc.data();
      const feedTitle = feedInfo.title || `@${username}`;
      
      // Transform tweets to match our RSS item structure
      const items = feedData.tweets.map(tweet => ({
        title: tweet.text.slice(0, 100) + (tweet.text.length > 100 ? '...' : ''),
        link: tweet.url,
        contentSnippet: tweet.text,
        pubDate: tweet.createdAt,
        categories: ['Twitter'],
        metrics: tweet.metrics,
        // Use first image as thumbnail if available
        thumbnail: tweet.media?.find(m => m.type === 'photo')?.url,
        media: tweet.media,
      }));
      
      // Save stories to permanent collection and get new stories
      const { saved, skipped } = await FeedStoriesService.saveStories(
        feedId,
        feedTitle,
        'twitter',
        items
      );
      
      activityLog.info(`Twitter feed ${feedTitle}: ${saved} new tweets, ${skipped} existing`);
      
      // Get the latest stories from the permanent collection for display
      const latestStories = await FeedStoriesService.getFeedStories(feedId, 50);
      
      // Update the feed document with the latest stories
      const updateData: any = {
        items: latestStories.map(story => ({
          title: story.title,
          link: story.link,
          contentSnippet: story.contentSnippet,
          pubDate: story.pubDate,
          categories: story.categories,
          metrics: story.metrics,
          thumbnail: story.thumbnail,
          media: story.media,
        })),
        lastFetched: new Date(),
      };
      
      // Only add twitterData if we have tweets
      if (feedData.tweets.length > 0 && feedData.username) {
        updateData.twitterData = {
          username: feedData.username,
          latestTweetId: feedData.tweets[0]?.id,
        };
      }
      
      await updateDoc(doc(db, 'rssFeeds', feedId), cleanFirestoreData(updateData));
      
      // Only process NEW items for bundle matching
      if (saved > 0) {
        const newItems = items.slice(0, saved);
        console.log(`Processing ${newItems.length} NEW tweets for bundle matching from ${feedTitle}`);
        
        for (const item of newItems) {
          await BundleItemsService.processFeedItemForBundles(feedId, feedTitle, 'twitter', item);
        }
      }
      
      // Return the number of new items processed
      return saved;
    } catch (error) {
      console.error('Error updating Twitter feed:', error);
      throw error;
    }
  }
  
  static async refreshTwitterFeed(feedId: string, username: string): Promise<number> {
    try {
      const itemCount = await this.updateTwitterFeedItems(feedId, username);
      return itemCount;
    } catch (error) {
      // Update feed with error status
      await updateDoc(doc(db, 'rssFeeds', feedId), cleanFirestoreData({
        lastError: error instanceof Error ? error.message : 'Unknown error',
        lastErrorAt: new Date(),
      }));
      throw error;
    }
  }
}