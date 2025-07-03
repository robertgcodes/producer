import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { FeedRefreshServiceServer } from '@/lib/services/feedRefreshService.server';
import { BundleSearchServiceServer } from '@/lib/services/bundleSearchService.server';
import { adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

// Vercel Cron Jobs run on UTC time
// This endpoint is configured to run every 30 minutes via vercel.json
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max execution time

export async function GET(request: Request) {
  try {
    // Verify the request is from Vercel Cron
    const { searchParams } = new URL(request.url);
    const cronSecret = searchParams.get('secret');
    
    // Debug logging
    console.log('[Cron] Environment check:', {
      NODE_ENV: process.env.NODE_ENV,
      hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
      serviceAccountLength: process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.length || 0
    });
    
    // In production, Vercel cron jobs are automatically authenticated
    if (process.env.NODE_ENV === 'production') {
      const headersList = await headers();
      const isVercelCron = headersList.get('x-vercel-cron') === '1';
      
      // Allow manual testing with secret parameter
      if (!isVercelCron && cronSecret !== process.env.CRON_SECRET) {
        console.log('[Cron] Unauthorized request - not from Vercel cron and no valid secret');
        return NextResponse.json(
          { error: 'Unauthorized - must be Vercel cron or provide valid secret' },
          { status: 401 }
        );
      }
      
      if (isVercelCron) {
        console.log('[Cron] Authenticated via Vercel cron header');
      } else if (cronSecret === process.env.CRON_SECRET) {
        console.log('[Cron] Authenticated via secret parameter (manual test)');
      }
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
    const feedsSnapshot = await adminDb.collection('rssFeeds').get();
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
        const refreshResult = await FeedRefreshServiceServer.refreshSpecificFeeds(
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
          await adminDb.collection('rssFeeds').doc(feedId).update({
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

    // Refresh bundle stories from the indexed feed items
    console.log('[Cron] Refreshing bundle stories from indexed feed items...');
    
    try {
      // Get all bundles
      const bundlesSnapshot = await adminDb.collection('bundles').get();
      results.bundleStories.total = bundlesSnapshot.size;
      
      console.log(`[Cron] Found ${bundlesSnapshot.size} bundles to refresh`);
      
      // Refresh stories for each bundle
      let bundleRefreshCount = 0;
      for (const bundleDoc of bundlesSnapshot.docs) {
        try {
          const bundleId = bundleDoc.id;
          const bundleTitle = bundleDoc.data().title || 'Untitled';
          
          console.log(`[Cron] Refreshing stories for bundle: ${bundleTitle}`);
          await BundleSearchServiceServer.refreshBundleStoriesFromIndex(bundleId);
          
          // Update the bundle's lastRefreshed timestamp
          await adminDb.collection('bundles').doc(bundleId).update({
            lastRefreshed: Timestamp.now()
          });
          
          bundleRefreshCount++;
        } catch (error) {
          console.error(`[Cron] Error refreshing bundle ${bundleDoc.id}:`, error);
          results.errors.push({
            feedId: bundleDoc.id,
            feedName: bundleDoc.data().title || 'Unknown bundle',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      
      results.bundleStories.refreshed = bundleRefreshCount;
      console.log(`[Cron] Successfully refreshed ${bundleRefreshCount} bundles`);
      
    } catch (error) {
      console.error('[Cron] Error refreshing bundle stories:', error);
      results.errors.push({
        feedId: 'bundles',
        feedName: 'Bundle Refresh',
        error: error instanceof Error ? error.message : String(error)
      });
    }

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