import { collection, doc, setDoc, deleteDoc, query, where, getDocs, writeBatch, onSnapshot, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Bundle } from '@/types';
import { cleanFirestoreData } from '@/lib/utils/firebaseHelpers';
import { RemovedStoriesService } from './removedStoriesService';

interface BundleItem {
  id: string;
  bundleId: string;
  feedId: string;
  feedTitle: string;
  feedType: string;
  itemId: string;
  title: string;
  link: string;
  pubDate: string;
  contentSnippet?: string;
  thumbnail?: string;
  relevanceScore: number;
  addedAt: Date;
  matchedTerms: string[];
}

export class BundleItemsService {
  // Process a new feed item against all bundles
  static async processFeedItemForBundles(feedId: string, feedTitle: string, feedType: string, item: any) {
    try {
      // Get all bundles
      const bundlesSnapshot = await getDocs(collection(db, 'bundles'));
      const bundles = bundlesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Bundle[];
      
      const batch = writeBatch(db);
      let matchCount = 0;
      
      for (const bundle of bundles) {
        // Check if item matches bundle criteria
        const matchResult = this.checkItemMatchesBundle(item, bundle);
        
        if (matchResult.matches) {
          // Check if this story has been removed from this bundle
          const isRemoved = await RemovedStoriesService.isRemoved(item.link, bundle.id);
          if (isRemoved) {
            console.log(`Skipping removed story "${item.title.substring(0, 50)}..." for bundle "${bundle.title}"`);
            continue;
          }
          
          const bundleItemId = `${bundle.id}_${feedId}_${item.guid || item.link}`.replace(/[^a-zA-Z0-9]/g, '_');
          const bundleItem: BundleItem = {
            id: bundleItemId,
            bundleId: bundle.id,
            feedId,
            feedTitle,
            feedType,
            itemId: item.guid || item.link,
            title: item.title,
            link: item.link,
            pubDate: item.pubDate?.toDate ? item.pubDate.toDate().toISOString() : item.pubDate,
            contentSnippet: item.contentSnippet || item.description,
            thumbnail: item.thumbnail,
            relevanceScore: matchResult.score,
            addedAt: new Date(),
            matchedTerms: matchResult.matchedTerms
          };
          
          batch.set(
            doc(db, 'bundleItems', bundleItemId),
            cleanFirestoreData(bundleItem)
          );
          matchCount++;
        }
      }
      
      if (matchCount > 0) {
        await batch.commit();
        console.log(`Added item "${item.title.substring(0, 50)}..." to ${matchCount} bundles`);
      }
    } catch (error) {
      console.error('Error processing feed item for bundles:', error);
    }
  }
  
  // Check if an item matches a bundle's criteria
  private static checkItemMatchesBundle(item: any, bundle: Bundle): { matches: boolean; score: number; matchedTerms: string[] } {
    const matchedTerms: string[] = [];
    let score = 0;
    
    // Combine all searchable fields
    const searchableText = [
      item.title || '',
      item.contentSnippet || '',
      item.description || '',
      item.content || '',
      item.link || '',
      item.author || '',
      item.creator || '',
      ...(item.categories || [])
    ].join(' ').toLowerCase();
    
    // Check bundle title - require phrase matching for multi-word
    const bundleTitleLower = bundle.title.toLowerCase();
    const bundleTitleWords = bundleTitleLower.split(/\s+/).filter(w => w.length > 2);
    
    if (bundleTitleWords.length > 1) {
      // Multi-word bundle title
      if (searchableText.includes(bundleTitleLower)) {
        // Exact phrase match
        matchedTerms.push(bundle.title);
        score += 30;
      } else if (bundleTitleWords.length === 2) {
        // For names (2 words), check individual words
        bundleTitleWords.forEach(word => {
          if (searchableText.includes(word)) {
            matchedTerms.push(word);
            score += 15;
          }
        });
      } else {
        // For longer phrases, require all words
        const allWordsPresent = bundleTitleWords.every(word => searchableText.includes(word));
        if (allWordsPresent) {
          matchedTerms.push(bundle.title);
          score += 20;
        }
      }
    } else if (bundleTitleWords.length === 1) {
      // Single word
      if (searchableText.includes(bundleTitleWords[0])) {
        matchedTerms.push(bundle.title);
        score += 20;
      }
    }
    
    // Check search terms - require phrase matching for multi-word
    if (bundle.searchTerms) {
      bundle.searchTerms.forEach(term => {
        const termLower = term.toLowerCase();
        const termWords = termLower.split(/\s+/).filter(w => w.length > 2);
        
        if (termWords.length > 1) {
          // Multi-word search term - require exact phrase
          if (searchableText.includes(termLower)) {
            matchedTerms.push(term);
            score += 25;
          }
        } else if (termWords.length === 1) {
          // Single word search term
          if (searchableText.includes(termWords[0])) {
            matchedTerms.push(term);
            score += 15;
          }
        }
      });
    }
    
    // Boost for recent items
    if (item.pubDate) {
      try {
        const pubDate = new Date(item.pubDate);
        const daysSincePublished = (Date.now() - pubDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSincePublished < 1) score += 10;
        else if (daysSincePublished < 3) score += 5;
        else if (daysSincePublished < 7) score += 2;
      } catch (e) {
        // Invalid date, skip boost
      }
    }
    
    return {
      matches: matchedTerms.length > 0,
      score,
      matchedTerms: [...new Set(matchedTerms)] // Remove duplicates
    };
  }
  
  // Get items for a specific bundle
  static async getBundleItems(bundleId: string, limit?: number): Promise<BundleItem[]> {
    try {
      let q = query(
        collection(db, 'bundleItems'),
        where('bundleId', '==', bundleId),
        orderBy('relevanceScore', 'desc'),
        orderBy('pubDate', 'desc')
      );
      
      if (limit) {
        q = query(q, firestoreLimit(limit));
      }
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as BundleItem);
    } catch (error) {
      console.error('Error getting bundle items:', error);
      return [];
    }
  }
  
  // Subscribe to bundle items (real-time updates)
  static subscribeToBundleItems(
    bundleId: string, 
    callback: (items: BundleItem[]) => void,
    limitCount?: number
  ): () => void {
    let q = query(
      collection(db, 'bundleItems'),
      where('bundleId', '==', bundleId),
      orderBy('relevanceScore', 'desc'),
      orderBy('pubDate', 'desc')
    );
    
    if (limitCount) {
      q = query(q, limit(limitCount));
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => doc.data() as BundleItem);
      callback(items);
    });
    
    return unsubscribe;
  }
  
  // Clean up old bundle items (e.g., older than 30 days)
  static async cleanupOldBundleItems(daysToKeep: number = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      const q = query(
        collection(db, 'bundleItems'),
        where('pubDate', '<', cutoffDate.toISOString())
      );
      
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      let deleteCount = 0;
      
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        deleteCount++;
      });
      
      if (deleteCount > 0) {
        await batch.commit();
        console.log(`Cleaned up ${deleteCount} old bundle items`);
      }
    } catch (error) {
      console.error('Error cleaning up old bundle items:', error);
    }
  }
  
  // Remove all items for a specific bundle (when bundle is deleted)
  static async removeBundleItems(bundleId: string) {
    try {
      const q = query(
        collection(db, 'bundleItems'),
        where('bundleId', '==', bundleId)
      );
      
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log(`Removed all items for bundle ${bundleId}`);
    } catch (error) {
      console.error('Error removing bundle items:', error);
    }
  }
}