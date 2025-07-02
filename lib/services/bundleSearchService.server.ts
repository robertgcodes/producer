import { adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export class BundleSearchServiceServer {
  // Simplified version for server-side cron job
  static async refreshBundleStoriesFromIndex(bundleId: string): Promise<void> {
    console.log(`[BundleRefresh] Server-side refresh for bundle ${bundleId}`);
    
    try {
      // Get the bundle to verify it exists
      const bundleDoc = await adminDb.collection('bundles').doc(bundleId).get();
      
      if (!bundleDoc.exists) {
        throw new Error(`Bundle ${bundleId} not found`);
      }
      
      // Clear the cache for this bundle by updating a timestamp
      // This will force the client to refresh from indexed items
      await adminDb.collection('bundles').doc(bundleId).update({
        cacheInvalidatedAt: Timestamp.now(),
        lastRefreshed: Timestamp.now()
      });
      
      console.log(`[BundleRefresh] Cache invalidated for bundle ${bundleId}`);
    } catch (error) {
      console.error(`[BundleRefresh] Error refreshing bundle ${bundleId}:`, error);
      throw error;
    }
  }
}