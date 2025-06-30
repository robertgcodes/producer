import { collection, doc, setDoc, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface RemovedStory {
  storyId: string;
  bundleId: string;
  userId: string;
  storyUrl: string;
  removedAt: Date;
}

export class RemovedStoriesService {
  private static readonly COLLECTION_NAME = 'removedStories';

  /**
   * Mark a story as removed from a bundle
   */
  static async markAsRemoved(
    storyId: string, 
    bundleId: string, 
    userId: string,
    storyUrl: string
  ): Promise<void> {
    const docId = `${bundleId}_${storyId}`;
    await setDoc(doc(db, this.COLLECTION_NAME, docId), {
      storyId,
      bundleId,
      userId,
      storyUrl,
      removedAt: new Date()
    });
  }

  /**
   * Check if a story has been removed from a bundle
   */
  static async isRemoved(
    storyUrl: string,
    bundleId: string
  ): Promise<boolean> {
    const q = query(
      collection(db, this.COLLECTION_NAME),
      where('bundleId', '==', bundleId),
      where('storyUrl', '==', storyUrl)
    );
    
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  }

  /**
   * Get all removed stories for a bundle
   */
  static async getRemovedStoriesForBundle(bundleId: string): Promise<string[]> {
    const q = query(
      collection(db, this.COLLECTION_NAME),
      where('bundleId', '==', bundleId)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data().storyUrl);
  }

  /**
   * Restore a removed story (remove it from the removed list)
   */
  static async restoreStory(storyId: string, bundleId: string): Promise<void> {
    const docId = `${bundleId}_${storyId}`;
    await deleteDoc(doc(db, this.COLLECTION_NAME, docId));
  }

  /**
   * Clear all removed stories for a bundle
   */
  static async clearRemovedStoriesForBundle(bundleId: string): Promise<void> {
    const q = query(
      collection(db, this.COLLECTION_NAME),
      where('bundleId', '==', bundleId)
    );
    
    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
  }
}