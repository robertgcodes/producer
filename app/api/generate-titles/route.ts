import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { analyzeFeedsAndGenerateTitles } from '@/lib/services/titleGenerator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const freshnessFilter = body.freshnessFilter || 3; // Default to 3 days
    
    // Get all RSS feeds with their items
    const feedsRef = collection(db, 'rssFeeds');
    const feedsSnapshot = await getDocs(feedsRef);
    
    const allItems: any[] = [];
    
    // Calculate cutoff date based on freshness filter
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - freshnessFilter);
    
    // Collect all recent items from all feeds
    feedsSnapshot.docs.forEach(doc => {
      const feedData = doc.data();
      if (feedData.items && Array.isArray(feedData.items)) {
        feedData.items.forEach((item: any) => {
          const itemDate = new Date(item.pubDate || item.isoDate || 0);
          // Only include items within the freshness window
          if (itemDate >= cutoffDate) {
            allItems.push({
              ...item,
              feedTitle: feedData.title,
              feedCategory: feedData.category
            });
          }
        });
      }
    });
    
    // Sort by date and take recent items
    allItems.sort((a, b) => {
      const dateA = new Date(a.pubDate || a.isoDate || 0);
      const dateB = new Date(b.pubDate || b.isoDate || 0);
      return dateB.getTime() - dateA.getTime();
    });
    
    const recentItems = allItems.slice(0, 50); // Top 50 most recent items
    
    // Generate titles based on the feed content
    const titles = await analyzeFeedsAndGenerateTitles(recentItems);
    
    return NextResponse.json({ titles });
  } catch (error) {
    console.error('Error generating titles:', error);
    return NextResponse.json(
      { error: 'Failed to generate titles' },
      { status: 500 }
    );
  }
}