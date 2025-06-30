import { writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cleanFirestoreData } from '@/lib/utils/firebaseHelpers';

interface PendingUpdate {
  feedId: string;
  type: 'success' | 'error';
  error?: string;
  timestamp: Date;
}

class FeedHealthBatcher {
  private pendingUpdates: Map<string, PendingUpdate> = new Map();
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY = 5000; // 5 seconds
  private readonly MAX_BATCH_SIZE = 100; // Firestore limit is 500, but we'll be conservative

  /**
   * Queue a success update
   */
  queueSuccess(feedId: string) {
    this.pendingUpdates.set(feedId, {
      feedId,
      type: 'success',
      timestamp: new Date()
    });
    this.scheduleBatch();
  }

  /**
   * Queue an error update
   */
  queueError(feedId: string, error: string) {
    // If there's already a pending update for this feed, update it
    const existing = this.pendingUpdates.get(feedId);
    if (existing && existing.type === 'error') {
      // Keep the error, don't overwrite with another error
      return;
    }

    this.pendingUpdates.set(feedId, {
      feedId,
      type: 'error',
      error,
      timestamp: new Date()
    });
    this.scheduleBatch();
  }

  /**
   * Schedule a batch update
   */
  private scheduleBatch() {
    // If we have too many pending updates, flush immediately
    if (this.pendingUpdates.size >= this.MAX_BATCH_SIZE) {
      this.flushBatch();
      return;
    }

    // Otherwise, schedule a delayed flush
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    this.batchTimer = setTimeout(() => {
      this.flushBatch();
    }, this.BATCH_DELAY);
  }

  /**
   * Flush all pending updates
   */
  private async flushBatch() {
    if (this.pendingUpdates.size === 0) return;

    // Clear the timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    // Copy and clear pending updates
    const updates = Array.from(this.pendingUpdates.values());
    this.pendingUpdates.clear();

    try {
      // Get current feed data for error counts
      const { collection, getDocs } = await import('firebase/firestore');
      const feedsSnapshot = await getDocs(collection(db, 'rssFeeds'));
      const feedsMap = new Map(
        feedsSnapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() }])
      );

      // Process updates in batches
      for (let i = 0; i < updates.length; i += this.MAX_BATCH_SIZE) {
        const batch = writeBatch(db);
        const batchUpdates = updates.slice(i, i + this.MAX_BATCH_SIZE);

        for (const update of batchUpdates) {
          const feedData = feedsMap.get(update.feedId);
          if (!feedData) {
            console.warn(`Feed ${update.feedId} not found, skipping health update`);
            continue;
          }

          const feedRef = doc(db, 'rssFeeds', update.feedId);

          if (update.type === 'success') {
            batch.update(feedRef, cleanFirestoreData({
              lastSuccessfulFetch: update.timestamp,
              errorCount: 0,
              lastError: null,
              lastFetched: update.timestamp
            }));
          } else {
            const currentErrorCount = feedData.errorCount || 0;
            batch.update(feedRef, cleanFirestoreData({
              lastError: update.error,
              errorCount: currentErrorCount + 1,
              lastFetched: update.timestamp
            }));
          }
        }

        // Commit the batch
        await batch.commit();
      }

      console.log(`Flushed ${updates.length} feed health updates`);
    } catch (error) {
      console.error('Error flushing feed health batch:', error);
      // Don't re-throw to avoid cascading errors
    }
  }

  /**
   * Force flush all pending updates (useful for cleanup)
   */
  async flush() {
    await this.flushBatch();
  }
}

// Export a singleton instance
export const feedHealthBatcher = new FeedHealthBatcher();