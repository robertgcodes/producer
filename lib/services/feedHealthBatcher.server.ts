import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { cleanFirestoreData } from '@/lib/utils/firebaseHelpers';

interface PendingUpdate {
  feedId: string;
  type: 'success' | 'error';
  error?: string;
  timestamp: Date;
}

class FeedHealthBatcherServer {
  private pendingUpdates: Map<string, PendingUpdate> = new Map();
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY = 5000; // 5 seconds
  private readonly MAX_BATCH_SIZE = 100;

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
    const existing = this.pendingUpdates.get(feedId);
    if (existing && existing.type === 'error') {
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
   * Schedule batch processing
   */
  private scheduleBatch() {
    if (this.batchTimer) {
      return;
    }

    if (this.pendingUpdates.size >= this.MAX_BATCH_SIZE) {
      this.flushBatch();
    } else {
      this.batchTimer = setTimeout(() => {
        this.flushBatch();
      }, this.BATCH_DELAY);
    }
  }

  /**
   * Flush all pending updates
   */
  private async flushBatch() {
    if (this.pendingUpdates.size === 0) {
      return;
    }

    const updates = Array.from(this.pendingUpdates.values());
    this.pendingUpdates.clear();
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    try {
      const batch = adminDb.batch();
      
      for (const update of updates) {
        const feedHealthRef = adminDb.collection('feedHealth').doc(update.feedId);
        
        if (update.type === 'success') {
          batch.set(feedHealthRef, cleanFirestoreData({
            lastSuccess: update.timestamp,
            consecutiveErrors: 0,
            isHealthy: true,
            lastChecked: update.timestamp
          }), { merge: true });
        } else {
          batch.set(feedHealthRef, cleanFirestoreData({
            lastError: update.timestamp,
            lastErrorMessage: update.error || 'Unknown error',
            consecutiveErrors: FieldValue.increment(1),
            isHealthy: false,
            lastChecked: update.timestamp
          }), { merge: true });
        }
      }
      
      await batch.commit();
      console.log(`[FeedHealthBatcher] Successfully updated ${updates.length} feed health records`);
    } catch (error) {
      console.error('Error flushing feed health batch:', error);
    }
  }

  /**
   * Force flush (useful for cleanup)
   */
  async forceFlush() {
    await this.flushBatch();
  }
}

// Export singleton instance
export const feedHealthBatcherServer = new FeedHealthBatcherServer();