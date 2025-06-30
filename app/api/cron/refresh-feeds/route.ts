import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { FeedRefreshService } from '@/lib/services/feedRefreshService';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc,
  doc,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Vercel Cron Jobs run on UTC time
// This endpoint is configured to run every 30 minutes via vercel.json
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max execution time

export async function GET(request: Request) {
  try {
    // Verify the request is from Vercel Cron
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.log('[Cron] Unauthorized request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Cron] Starting scheduled feed refresh');
    
    const startTime = Date.now();
    const results = {
      totalFeeds: 0,
      refreshedFeeds: 0,
      skippedFeeds: 0,
      errors: [] as Array<{ feedId?: string; feedName?: string; title?: string; error: string }>,
      bundleStories: {
        total: 0,
        refreshed: 0
      }
    };

    // Get all RSS feeds from the database
    const feedsSnapshot = await getDocs(collection(db, 'rssFeeds'));
    const allFeeds = feedsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || '',
        type: data.type || 'rss',
        lastRefreshed: data.lastRefreshed,
        ...data
      };
    });

    // Filter out Twitter/X feeds and inactive feeds
    const feedsToRefresh = allFeeds.filter(feed => {
      // Skip Twitter feeds
      if (feed.type === 'twitter') {
        console.log(`[Cron] Skipping Twitter feed: ${feed.title}`);
        return false;
      }
      
      // Check if feed was refreshed recently (within last 25 minutes)
      const lastRefresh = feed.lastRefreshed?.toDate?.() || feed.lastRefreshed;
      const lastRefreshTime = lastRefresh ? new Date(lastRefresh).getTime() : 0;
      const timeSinceRefresh = Date.now() - lastRefreshTime;
      
      if (timeSinceRefresh < 25 * 60 * 1000) {
        results.skippedFeeds++;
        console.log(`[Cron] Skipping ${feed.title} - refreshed ${Math.round(timeSinceRefresh / 60000)} minutes ago`);
        return false;
      }
      
      return true;
    });

    results.totalFeeds = feedsToRefresh.length;
    console.log(`[Cron] Found ${results.totalFeeds} feeds to refresh (skipped ${results.skippedFeeds} recently refreshed)`);

    if (feedsToRefresh.length > 0) {
      // Use the existing FeedRefreshService to refresh feeds
      const feedIds = feedsToRefresh.map(f => f.id);
      
      try {
        const refreshResult = await FeedRefreshService.refreshSpecificFeeds(
          feedIds,
          (current, total) => {
            console.log(`[Cron] Progress: ${current}/${total} feeds`);
          }
        );
        
        results.refreshedFeeds = refreshResult.successCount;
        results.errors = refreshResult.failedFeeds.map(f => ({
          title: f.title,
          error: f.error
        }));
        
        // Update lastRefreshed timestamps for successful feeds
        const successfulFeedIds = feedIds.filter((id, index) => {
          const feed = feedsToRefresh[index];
          return !refreshResult.failedFeeds.find(f => f.title === feed.title);
        });
        
        for (const feedId of successfulFeedIds) {
          await updateDoc(doc(db, 'rssFeeds', feedId), {
            lastRefreshed: Timestamp.now()
          });
        }
      } catch (error) {
        console.error('[Cron] Error during batch refresh:', error);
        results.errors.push({
          feedId: 'batch',
          feedName: 'Batch Refresh',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Bundle stories are automatically refreshed when their source feeds are refreshed
    // The FeedRefreshService handles updating stories from RSS feeds
    console.log('[Cron] Bundle stories will be updated as part of feed refresh');
    results.bundleStories.total = results.refreshedFeeds;
    results.bundleStories.refreshed = results.refreshedFeeds;

    const duration = Date.now() - startTime;
    console.log(`[Cron] Feed refresh completed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      duration: `${(duration / 1000).toFixed(2)}s`,
      results
    });

  } catch (error) {
    console.error('[Cron] Fatal error in feed refresh:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}