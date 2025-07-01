'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc, query, orderBy, writeBatch, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RSSService } from '@/lib/services/rssService';
import { TwitterService } from '@/lib/services/twitterService';
import { toast } from 'sonner';
import { useAutoRefreshFeeds } from '@/hooks/useAutoRefreshFeeds';
import { YouTubeService } from '@/lib/services/youtubeService';
import { GoogleNewsService } from '@/lib/services/googleNewsService';
import { FeedRefreshService } from '@/lib/services/feedRefreshService';
import { cleanFirestoreData } from '@/lib/utils/firebaseHelpers';
import { formatDate } from '@/lib/utils/dateHelpers';
import { OPMLService } from '@/lib/services/opmlService';
import { FeedHealthService } from '@/lib/services/feedHealthService';
import { useAuth } from '@/contexts/AuthContext';

interface RSSFeed {
  id: string;
  title: string;
  url: string;
  category?: string;
  order: number;
  lastFetched?: Date;
  items?: RSSItem[];
  type?: 'rss' | 'twitter' | 'youtube' | 'googlenews';
  twitterUsername?: string;
  youtubeChannelId?: string;
  youtubeUrl?: string;
  googleNewsQuery?: string;
  feedTitle?: string;
  feedDescription?: string;
  freshnessFilter?: number;
  lastError?: string;
  errorCount?: number;
  lastSuccessfulFetch?: Date;
  createdAt?: any; // Can be Date or Firestore Timestamp
}

interface RSSItem {
  title: string;
  link: string;
  pubDate?: string;
  contentSnippet?: string;
  categories?: string[];
  thumbnail?: string;
}

interface RSSFeedBlockProps {
  feed: RSSFeed;
  onDelete: (id: string) => void;
  onRefresh: (id: string) => void;
  onEdit: (feed: RSSFeed) => void;
}

function RSSFeedBlock({ feed, onDelete, onRefresh, onEdit }: RSSFeedBlockProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Disable auto-fetch to prevent excessive writes
  // Users can manually refresh feeds that need updating
  // useEffect(() => {
  //   if (!feed.items || feed.items.length === 0) {
  //     if (!feed.lastFetched) {
  //       onRefresh(feed.id);
  //     }
  //   }
  // }, [feed.id, feed.items, feed.lastFetched, onRefresh]);

  return (
    <div
      className="bg-white dark:bg-gray-900 rounded-xl p-6 hover:shadow-lg transition-all duration-200"
    >
      <div className="flex items-start justify-between mb-4">
        <div 
          className="flex-1"
        >
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
            {feed.type === 'twitter' && (
              <svg className="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            )}
            {feed.type === 'youtube' && (
              <svg className="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            )}
            {feed.type === 'googlenews' && (
              <svg className="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.925 3.641H3.863L20.925 20.7V3.641zM0 3.641C0 1.63 1.631 0 3.641 0h17.284c2.01 0 3.641 1.63 3.641 3.641v17.284c0 2.01-1.631 3.641-3.641 3.641H3.641C1.631 24.566 0 22.935 0 20.925V3.641z"/>
                <path d="M6.5 7h11v2h-11zm0 4h11v2h-11zm0 4h7v2h-7z"/>
              </svg>
            )}
            {(!feed.type || feed.type === 'rss') && (
              <svg className="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5 3a1 1 0 000 2c5.523 0 10 4.477 10 10a1 1 0 102 0C17 8.373 11.627 3 5 3z"/>
                <path d="M4 9a1 1 0 011-1 7 7 0 017 7 1 1 0 11-2 0 5 5 0 00-5-5 1 1 0 01-1-1zM3 15a2 2 0 114 0 2 2 0 01-4 0z"/>
              </svg>
            )}
            {feed.title}
          </h3>
          <div className="flex items-center gap-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {feed.type === 'twitter' && feed.twitterUsername ? `@${feed.twitterUsername}` : 
               feed.type === 'youtube' ? 'YouTube Channel' :
               feed.type === 'googlenews' && feed.googleNewsQuery ? `Google News: ${feed.googleNewsQuery}` :
               feed.category || 'General'}
            </p>
            {feed.type === 'twitter' && (
              <span className="text-xs text-gray-400 dark:text-gray-500" title="Twitter feeds require manual refresh to save API costs">
                (manual refresh)
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={() => {
              onEdit(feed);
            }}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors z-10"
            title="Edit feed"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => {
              onDelete(feed.id);
            }}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors z-10"
            title="Delete feed"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* RSS Items Preview - Scrollable */}
      {feed.items && feed.items.length > 0 ? (
        <div className="mb-4">
          <div className="space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
            {feed.items.map((item, idx) => (
              <div key={idx} className="text-sm">
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-700 dark:text-gray-300 hover:text-brand-600 dark:hover:text-brand-400 block"
                >
                  <div className="flex items-start gap-2">
                    {item.thumbnail && (
                      <img 
                        src={item.thumbnail} 
                        alt="" 
                        className="w-16 h-9 object-cover rounded flex-shrink-0"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="line-clamp-2">{item.title}</span>
                      {item.pubDate && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {formatDate(item.pubDate, 'date')}
                        </p>
                      )}
                    </div>
                  </div>
                </a>
              </div>
            ))}
          </div>
          {feed.items.length > 5 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
              Scroll for more ({feed.items.length} total)
            </p>
          )}
        </div>
      ) : (
        <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {!feed.lastFetched ? (
            <div className="text-center">
              <p>Feed not yet fetched</p>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  setIsRefreshing(true);
                  await onRefresh(feed.id);
                  setIsRefreshing(false);
                }}
                className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 mt-1"
              >
                Click to refresh
              </button>
            </div>
          ) : (
            'No items available'
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>Last updated: {formatDate(feed.lastFetched, 'time')}</span>
        <button
          onClick={async (e) => {
            e.stopPropagation();
            setIsRefreshing(true);
            await onRefresh(feed.id);
            setIsRefreshing(false);
          }}
          className="hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1"
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <>
              <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Refreshing...
            </>
          ) : (
            'Refresh'
          )}
        </button>
      </div>
    </div>
  );
}

export function RSSFeedsView() {
  const { user } = useAuth();
  const [feeds, setFeeds] = useState<RSSFeed[]>([]);
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [feedUrl, setFeedUrl] = useState('');
  const [feedTitle, setFeedTitle] = useState('');
  const [feedCategory, setFeedCategory] = useState('');
  const [feedType, setFeedType] = useState<'rss' | 'twitter' | 'youtube' | 'googlenews'>('rss');
  const [twitterUsername, setTwitterUsername] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [googleNewsQuery, setGoogleNewsQuery] = useState('');
  const [generatedTitles, setGeneratedTitles] = useState<string[]>([]);
  const [isGeneratingTitles, setIsGeneratingTitles] = useState(false);
  const [isAddingFeed, setIsAddingFeed] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [freshnessFilter, setFreshnessFilter] = useState(7); // Default to 7 days
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedFeedTypes, setSelectedFeedTypes] = useState<Set<string>>(new Set());
  const [editingFeed, setEditingFeed] = useState<RSSFeed | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [importResults, setImportResults] = useState<{ success: number; failed: number; skipped: number } | null>(null);
  const [validateOnImport, setValidateOnImport] = useState(false);
  const [showHealthCheckModal, setShowHealthCheckModal] = useState(false);
  const [feedHealth, setFeedHealth] = useState<{ healthy: any[]; problematic: any[]; dead: any[]; convertible?: any[] } | null>(null);
  const [selectedConvertibleFeeds, setSelectedConvertibleFeeds] = useState<Set<string>>(new Set());
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [selectedDeadFeeds, setSelectedDeadFeeds] = useState<Set<string>>(new Set());
  const [selectedProblematicFeeds, setSelectedProblematicFeeds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'order' | 'recent' | 'name'>('recent');
  const [hideEmptyFeeds, setHideEmptyFeeds] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshProgress, setRefreshProgress] = useState<{ current: number; total: number } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto-refresh feeds every 30 minutes - disabled on initial load to prevent quota issues
  // useAutoRefreshFeeds(true, 30);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showExportMenu && !(event.target as Element).closest('.export-menu-container')) {
        setShowExportMenu(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu]);


  // Fetch RSS feeds from Firestore
  useEffect(() => {
    if (!user) return;
    
    const feedsRef = collection(db, 'rssFeeds');
    const q = query(feedsRef, where('userId', '==', user.uid), orderBy('order', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const feedsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as RSSFeed));
      
      setFeeds(feedsList);
    });

    return () => unsubscribe();
  }, [user]);

  // Sample RSS feeds for quick setup
  const sampleFeeds = [
    { title: 'TechCrunch', url: 'https://techcrunch.com/feed/', category: 'Technology', type: 'rss' },
    { title: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'Technology', type: 'rss' },
    { title: 'BBC News', url: 'https://feeds.bbci.co.uk/news/rss.xml', category: 'News', type: 'rss' },
    { title: 'Reuters', url: 'https://www.reutersagency.com/feed/?best-topics=tech&post_type=best', category: 'News', type: 'rss' },
    { title: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'Technology', type: 'rss' },
    { title: 'Wired', url: 'https://www.wired.com/feed/rss', category: 'Technology', type: 'rss' },
  ];
  
  // Sample YouTube channels (using direct channel IDs for reliability)
  const sampleYouTubeChannels = [
    { title: 'MKBHD', channelId: 'UCBJycsmduvYEL83R_U4JriQ', category: 'Technology' },
    { title: 'Linus Tech Tips', channelId: 'UCXuqSBlHAE6Xw-yeJA0Tunw', category: 'Technology' },
    { title: 'The Verge', channelId: 'UCddiUEpeqJcYeBxX1IVBKvQ', category: 'Technology' },
    { title: 'TED', channelId: 'UCAuUUnT6oDeKwE6v1NGQxug', category: 'Education' },
    { title: 'Vox', channelId: 'UCLXo7UDZvByw2ixzpQCufnA', category: 'News' },
    { title: 'Veritasium', channelId: 'UCHnyfMqiRRG1u-2MsSQLbXA', category: 'Science' },
  ];


  const handleAddFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    if (feedType === 'rss' && (!feedUrl.trim() || !feedTitle.trim())) return;
    if (feedType === 'twitter' && (!twitterUsername.trim() || !feedTitle.trim())) return;
    if (feedType === 'youtube' && (!youtubeUrl.trim() || !feedTitle.trim())) return;
    if (feedType === 'googlenews' && (!googleNewsQuery.trim() || !feedTitle.trim())) return;

    setIsAddingFeed(true);
    try {
      if (feedType === 'rss') {
        // First, validate the RSS feed by fetching it
        const feedData = await RSSService.fetchFeed(feedUrl);
        
        // Create the feed document
        const feedDoc = {
          title: feedTitle,
          url: feedUrl,
          userId: user.uid,
          category: feedCategory || 'General',
          order: feeds.length,
          lastFetched: new Date(),
          createdAt: new Date(),
          feedTitle: feedData.title,
          feedDescription: feedData.description,
          items: feedData.items.slice(0, 10), // Store first 10 items
          type: 'rss' as const,
        };

        const docRef = await addDoc(collection(db, 'rssFeeds'), cleanFirestoreData(feedDoc));
        
        // Update feed items in separate collection
        await RSSService.updateFeedItems(docRef.id, feedData);
        
        toast.success(`RSS feed "${feedTitle}" added successfully!`);
      } else if (feedType === 'twitter') {
        // Twitter feed - Extract username from URL if provided
        let username = twitterUsername.replace('@', '');
        
        // Check if it's a full Twitter/X URL
        if (twitterUsername.includes('twitter.com/') || twitterUsername.includes('x.com/')) {
          const urlMatch = twitterUsername.match(/(?:twitter\.com|x\.com)\/([^\/\?]+)/);
          if (urlMatch && urlMatch[1]) {
            username = urlMatch[1];
          }
        }
        
        // Create the feed document
        const feedDoc = {
          title: feedTitle,
          url: `https://twitter.com/${username}`,
          userId: user.uid,
          twitterUsername: username,
          category: feedCategory || 'Social',
          order: feeds.length,
          lastFetched: new Date(),
          createdAt: new Date(),
          type: 'twitter' as const,
        };

        const docRef = await addDoc(collection(db, 'rssFeeds'), cleanFirestoreData(feedDoc));
        
        // Fetch initial Twitter data
        await TwitterService.updateTwitterFeedItems(docRef.id, username);
        
        toast.success(`Twitter feed "@${username}" added successfully!`);
      } else if (feedType === 'youtube') {
        // YouTube feed
        try {
          const { feedUrl: ytFeedUrl } = await YouTubeService.getChannelRSSUrl(youtubeUrl);
          const feedData = await YouTubeService.fetchYouTubeFeed(ytFeedUrl);
          
          // Create the feed document
          const feedDoc = {
            title: feedTitle,
            url: ytFeedUrl,
            userId: user.uid,
            youtubeUrl: youtubeUrl,
            category: feedCategory || 'Video',
            order: feeds.length,
            lastFetched: new Date(),
            createdAt: new Date(),
            feedTitle: feedData.title,
            feedDescription: feedData.description,
            items: feedData.items.slice(0, 10), // Store first 10 items
            type: 'youtube' as const,
          };

          const docRef = await addDoc(collection(db, 'rssFeeds'), cleanFirestoreData(feedDoc));
          
          // Update feed items in separate collection
          await RSSService.updateFeedItems(docRef.id, feedData);
          
          toast.success(`YouTube channel "${feedTitle}" added successfully!`);
        } catch (error) {
          throw new Error(`Failed to add YouTube channel: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else if (feedType === 'googlenews') {
        // Google News feed
        try {
          // Convert freshness filter to Google News time parameter
          const when = GoogleNewsService.daysToGoogleWhen(freshnessFilter);
          const feedData = await GoogleNewsService.getGoogleNewsFeed(googleNewsQuery, { when });
          
          // Create the feed document
          const feedDoc = {
            title: feedTitle,
            url: GoogleNewsService.buildGoogleNewsUrl(googleNewsQuery, { when }),
            userId: user.uid,
            googleNewsQuery: googleNewsQuery,
            category: feedCategory || 'News',
            order: feeds.length,
            lastFetched: new Date(),
            createdAt: new Date(),
            feedTitle: feedData.title,
            feedDescription: feedData.description,
            items: feedData.items.slice(0, 10), // Store first 10 items
            type: 'googlenews' as const,
            freshnessFilter: freshnessFilter,
          };

          const docRef = await addDoc(collection(db, 'rssFeeds'), cleanFirestoreData(feedDoc));
          
          // Update feed items in separate collection
          const feedDataWithDefaults = {
            ...feedData,
            items: feedData.items.map(item => ({
              ...item,
              pubDate: item.pubDate || new Date().toISOString(),
              contentSnippet: item.contentSnippet || '',
              guid: item.guid || item.link
            }))
          };
          await RSSService.updateFeedItems(docRef.id, feedDataWithDefaults);
          
          toast.success(`Google News feed "${feedTitle}" added successfully!`);
        } catch (error) {
          throw new Error(`Failed to add Google News feed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      setFeedUrl('');
      setFeedTitle('');
      setFeedCategory('');
      setTwitterUsername('');
      setYoutubeUrl('');
      setGoogleNewsQuery('');
      setFeedType('rss');
      setShowAddFeed(false);
    } catch (error) {
      console.error('Error adding feed:', error);
      toast.error(error instanceof Error ? error.message : `Failed to add ${feedType === 'rss' ? 'RSS' : feedType === 'twitter' ? 'Twitter' : 'YouTube'} feed`);
    } finally {
      setIsAddingFeed(false);
    }
  };

  const handleDeleteFeed = async (feedId: string) => {
    if (!confirm('Are you sure you want to delete this feed?')) return;
    
    try {
      await deleteDoc(doc(db, 'rssFeeds', feedId));
      toast.success('Feed deleted successfully');
    } catch (error) {
      console.error('Error deleting feed:', error);
      toast.error('Failed to delete feed');
    }
  };

  const handleRefreshFeed = async (feedId: string) => {
    try {
      await FeedRefreshService.refreshFeed(feedId);
      toast.success('Feed refreshed successfully');
    } catch (error) {
      console.error('Error refreshing feed:', error);
      toast.error('Failed to refresh feed');
    }
  };

  const handleEditFeed = (feed: RSSFeed) => {
    setEditingFeed(feed);
    setFeedTitle(feed.title);
    setFeedCategory(feed.category || '');
    setFeedType(feed.type || 'rss');
    if (feed.type === 'twitter' && feed.twitterUsername) {
      setTwitterUsername(feed.twitterUsername);
    } else if (feed.type === 'youtube' && feed.youtubeUrl) {
      setYoutubeUrl(feed.youtubeUrl);
    } else if (feed.type === 'googlenews' && feed.googleNewsQuery) {
      setGoogleNewsQuery(feed.googleNewsQuery);
    } else if (feed.url) {
      setFeedUrl(feed.url);
    }
    setShowAddFeed(true);
  };

  const handleUpdateFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFeed) return;
    
    setIsAddingFeed(true);
    try {
      const updates: any = {
        title: feedTitle,
        category: feedCategory || 'General',
        updatedAt: new Date(),
      };
      
      if (feedType === 'twitter') {
        let username = twitterUsername.replace('@', '');
        
        // Check if it's a full Twitter/X URL
        if (twitterUsername.includes('twitter.com/') || twitterUsername.includes('x.com/')) {
          const urlMatch = twitterUsername.match(/(?:twitter\.com|x\.com)\/([^\/\?]+)/);
          if (urlMatch && urlMatch[1]) {
            username = urlMatch[1];
          }
        }
        
        updates.twitterUsername = username;
        updates.url = `https://twitter.com/${username}`;
      } else if (feedType === 'youtube') {
        // For YouTube feeds, keep the existing URL (don't update it)
        // YouTube URLs are set during initial creation and shouldn't change
        if (youtubeUrl && youtubeUrl !== editingFeed.youtubeUrl) {
          // If the YouTube URL changed, we need to get the new RSS URL
          try {
            const { feedUrl: ytFeedUrl } = await YouTubeService.getChannelRSSUrl(youtubeUrl);
            updates.url = ytFeedUrl;
            updates.youtubeUrl = youtubeUrl;
          } catch (error) {
            throw new Error(`Failed to update YouTube channel URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      } else if (feedType === 'googlenews') {
        // Google News feed
        updates.googleNewsQuery = googleNewsQuery;
        const when = GoogleNewsService.daysToGoogleWhen(freshnessFilter);
        updates.url = GoogleNewsService.buildGoogleNewsUrl(googleNewsQuery, { when });
        updates.freshnessFilter = freshnessFilter;
      } else {
        // Regular RSS feed
        updates.url = feedUrl;
      }
      
      await updateDoc(doc(db, 'rssFeeds', editingFeed.id), cleanFirestoreData(updates));
      
      toast.success('Feed updated successfully!');
      setEditingFeed(null);
      setFeedUrl('');
      setFeedTitle('');
      setFeedCategory('');
      setTwitterUsername('');
      setYoutubeUrl('');
      setGoogleNewsQuery('');
      setFeedType('rss');
      setShowAddFeed(false);
    } catch (error) {
      console.error('Error updating feed:', error);
      toast.error('Failed to update feed');
    } finally {
      setIsAddingFeed(false);
    }
  };

  const generateYouTubeTitles = async () => {
    setIsGeneratingTitles(true);
    try {
      const response = await fetch('/api/generate-titles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          freshnessFilter: freshnessFilter,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate titles');
      }
      
      const data = await response.json();
      setGeneratedTitles(data.titles || []);
      toast.success('Generated new YouTube title ideas!');
    } catch (error) {
      console.error('Error generating titles:', error);
      toast.error('Failed to generate titles. Make sure you have RSS feeds with content.');
    } finally {
      setIsGeneratingTitles(false);
    }
  };

  const exportToJSON = () => {
    const exportData = {
      feeds: feeds.map(feed => ({
        title: feed.title,
        url: feed.url,
        category: feed.category,
        feedTitle: feed.feedTitle,
        feedDescription: feed.feedDescription,
        lastFetched: feed.lastFetched,
      })),
      exportDate: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rss-feeds-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Feeds exported to JSON');
  };

  const refreshFilteredFeeds = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    setRefreshProgress({ current: 0, total: filteredFeeds.length });
    
    try {
      const result = await FeedRefreshService.refreshSpecificFeeds(
        filteredFeeds.map(f => f.id),
        (current, total) => {
          setRefreshProgress({ current, total });
        }
      );
      
      if (result.failedCount === 0) {
        toast.success(`All ${result.successCount} feeds refreshed successfully`);
      } else {
        toast.warning(`Refreshed ${result.successCount} feeds. ${result.failedCount} failed.`);
        console.log('Failed feeds:', result.failedFeeds);
      }
    } catch (error) {
      console.error('Error refreshing feeds:', error);
      toast.error('Failed to refresh feeds');
    } finally {
      setIsRefreshing(false);
      setRefreshProgress(null);
    }
  };

  const exportToOPML = () => {
    const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>RSS Feeds Export</title>
    <dateCreated>${new Date().toUTCString()}</dateCreated>
  </head>
  <body>
    ${feeds.map(feed => `<outline text="${feed.title}" title="${feed.title}" type="rss" xmlUrl="${feed.url}" category="${feed.category || 'General'}" />`).join('\n    ')}
  </body>
</opml>`;
    
    const blob = new Blob([opml], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rss-feeds-${new Date().toISOString().split('T')[0]}.opml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Feeds exported to OPML');
  };

  // Filter items by freshness
  const filterItemsByFreshness = (items: RSSItem[] | undefined) => {
    if (!items) return [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - freshnessFilter);
    
    return items.filter(item => {
      if (!item.pubDate) return false;
      const itemDate = new Date(item.pubDate);
      return itemDate >= cutoffDate;
    });
  };

  // Get unique categories from feeds
  const allCategories = useMemo(() => {
    const categories = new Set<string>();
    feeds.forEach(feed => {
      categories.add(feed.category || 'General');
    });
    return Array.from(categories).sort();
  }, [feeds]);

  // Filter feeds based on selected categories and feed types
  const filteredFeeds = useMemo(() => {
    let filtered = feeds;
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(feed => 
        feed.title.toLowerCase().includes(query) ||
        feed.url?.toLowerCase().includes(query) ||
        feed.feedTitle?.toLowerCase().includes(query) ||
        feed.twitterUsername?.toLowerCase().includes(query) ||
        feed.googleNewsQuery?.toLowerCase().includes(query) ||
        (feed.category || 'General').toLowerCase().includes(query)
      );
    }
    
    // Filter by categories
    if (selectedCategories.size > 0) {
      filtered = filtered.filter(feed => selectedCategories.has(feed.category || 'General'));
    }
    
    // Filter by feed types
    if (selectedFeedTypes.size > 0) {
      filtered = filtered.filter(feed => selectedFeedTypes.has(feed.type || 'rss'));
    }
    
    // Hide empty feeds if option is enabled
    if (hideEmptyFeeds) {
      filtered = filtered.filter(feed => {
        const freshItems = filterItemsByFreshness(feed.items);
        return freshItems.length > 0;
      });
    }
    
    // Sort feeds
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'recent') {
        // Sort by creation date (most recent first)
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB.getTime() - dateA.getTime();
      } else if (sortBy === 'name') {
        // Sort alphabetically by title
        return a.title.localeCompare(b.title);
      } else {
        // Default sort by order
        return a.order - b.order;
      }
    });
    
    return sorted;
  }, [feeds, selectedCategories, selectedFeedTypes, hideEmptyFeeds, sortBy, searchQuery]);

  const toggleCategory = (category: string) => {
    const newCategories = new Set(selectedCategories);
    if (newCategories.has(category)) {
      newCategories.delete(category);
    } else {
      newCategories.add(category);
    }
    setSelectedCategories(newCategories);
  };

  const toggleFeedType = (feedType: string) => {
    const newFeedTypes = new Set(selectedFeedTypes);
    if (newFeedTypes.has(feedType)) {
      newFeedTypes.delete(feedType);
    } else {
      newFeedTypes.add(feedType);
    }
    setSelectedFeedTypes(newFeedTypes);
  };

  const handleImportOPML = async (file: File) => {
    try {
      const content = await file.text();
      
      // Validate OPML
      if (!OPMLService.isValidOPML(content)) {
        toast.error('Invalid OPML file format');
        return;
      }
      
      // Parse OPML
      const opmlFeeds = OPMLService.parseOPML(content);
      
      if (opmlFeeds.length === 0) {
        toast.error('No feeds found in the OPML file');
        return;
      }
      
      // Get existing feed URLs to check for duplicates
      const existingUrls = new Set(feeds.map(f => f.url.toLowerCase()));
      
      setImportProgress({ current: 0, total: opmlFeeds.length });
      setImportResults({ success: 0, failed: 0, skipped: 0 });
      
      let successCount = 0;
      let failedCount = 0;
      let skippedCount = 0;
      
      // Process feeds in batches using Firestore batch writes
      // Firestore allows max 500 operations per batch, but we'll use smaller batches
      const FIRESTORE_BATCH_SIZE = 20; // Reduced to avoid write stream exhaustion
      const RATE_LIMIT_DELAY = 2000; // 2 seconds between batches
      
      for (let i = 0; i < opmlFeeds.length; i += FIRESTORE_BATCH_SIZE) {
        const batchFeeds = opmlFeeds.slice(i, Math.min(i + FIRESTORE_BATCH_SIZE, opmlFeeds.length));
        const batch = writeBatch(db);
        const feedsToValidate: Array<{ feed: any; docRef: any }> = [];
        
        for (let j = 0; j < batchFeeds.length; j++) {
          const opmlFeed = batchFeeds[j];
          const currentIndex = i + j;
          
          try {
            // Check for duplicates
            if (existingUrls.has(opmlFeed.xmlUrl.toLowerCase())) {
              skippedCount++;
              setImportResults({ success: successCount, failed: failedCount, skipped: skippedCount });
              setImportProgress({ current: currentIndex + 1, total: opmlFeeds.length });
              continue;
            }
            
            // Create a new document reference
            const docRef = doc(collection(db, 'rssFeeds'));
            
            let feedDoc: any = {
              title: opmlFeed.title,
              url: opmlFeed.xmlUrl,
              category: opmlFeed.category || 'General',
              order: feeds.length + currentIndex,
              createdAt: new Date(),
              type: 'rss' as const,
              feedTitle: opmlFeed.title,
              feedDescription: opmlFeed.description || '',
            };
            
            // Add to batch
            batch.set(docRef, cleanFirestoreData(feedDoc));
            
            if (validateOnImport) {
              feedsToValidate.push({ feed: opmlFeed, docRef });
            }
            
            successCount++;
            setImportResults({ success: successCount, failed: failedCount, skipped: skippedCount });
            setImportProgress({ current: currentIndex + 1, total: opmlFeeds.length });
            
          } catch (error) {
            console.error(`Failed to prepare feed ${opmlFeed.title} for import:`, error);
            failedCount++;
            setImportResults({ success: successCount, failed: failedCount, skipped: skippedCount });
            setImportProgress({ current: currentIndex + 1, total: opmlFeeds.length });
          }
        }
        
        // Commit the batch
        try {
          await batch.commit();
          
          // If validation is enabled, fetch feeds in smaller parallel batches
          if (validateOnImport && feedsToValidate.length > 0) {
            const VALIDATION_BATCH_SIZE = 3; // Small batch to avoid overwhelming servers
            
            for (let k = 0; k < feedsToValidate.length; k += VALIDATION_BATCH_SIZE) {
              const validationBatch = feedsToValidate.slice(k, Math.min(k + VALIDATION_BATCH_SIZE, feedsToValidate.length));
              
              await Promise.all(validationBatch.map(async ({ feed, docRef }) => {
                try {
                  const feedData = await RSSService.fetchFeed(feed.xmlUrl);
                  const updateData = {
                    lastFetched: new Date(),
                    feedTitle: feedData.title || feed.title,
                    feedDescription: feedData.description || feed.description,
                    items: feedData.items.slice(0, 10),
                  };
                  
                  await updateDoc(docRef, cleanFirestoreData(updateData));
                  await RSSService.updateFeedItems(docRef.id, feedData);
                } catch (fetchError) {
                  console.warn(`Could not fetch feed ${feed.title}, keeping metadata only:`, fetchError);
                }
              }));
              
              // Small delay between validation batches
              if (k + VALIDATION_BATCH_SIZE < feedsToValidate.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            }
          }
          
        } catch (batchError) {
          console.error('Failed to commit batch:', batchError);
          // Update failed count for all feeds in this batch that weren't already processed
          const unprocessedInBatch = batchFeeds.length - (successCount - (i > 0 ? i : 0));
          failedCount += unprocessedInBatch;
          setImportResults({ success: successCount, failed: failedCount, skipped: skippedCount });
        }
        
        // Add delay between batches to avoid rate limiting
        if (i + FIRESTORE_BATCH_SIZE < opmlFeeds.length) {
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
        }
      }
      
      // Show final results
      if (successCount > 0) {
        toast.success(`Successfully imported ${successCount} feed${successCount > 1 ? 's' : ''}`);
        if (!validateOnImport) {
          toast.info('Use "Refresh All" to fetch the latest content from your imported feeds', { duration: 5000 });
        }
      }
      if (skippedCount > 0) {
        toast.info(`Skipped ${skippedCount} duplicate feed${skippedCount > 1 ? 's' : ''}`);
      }
      if (failedCount > 0) {
        toast.error(`Failed to import ${failedCount} feed${failedCount > 1 ? 's' : ''}`);
      }
      
      // Reset after a delay
      setTimeout(() => {
        setImportProgress(null);
        setImportResults(null);
        setShowImportModal(false);
      }, 3000);
      
    } catch (error) {
      console.error('Error importing OPML:', error);
      toast.error('Failed to import OPML file');
      setImportProgress(null);
      setImportResults(null);
    }
  };

  const handleCheckFeedHealth = async () => {
    setIsCheckingHealth(true);
    try {
      const health = await FeedHealthService.checkFeedHealth();
      
      // Separate convertible feeds from healthy ones
      const convertible = health.healthy.filter(feed => feed.suggestedType);
      const trueHealthy = health.healthy.filter(feed => !feed.suggestedType);
      
      const enhancedHealth = {
        ...health,
        healthy: trueHealthy,
        convertible: convertible
      };
      
      setFeedHealth(enhancedHealth);
      
      if (health.dead.length === 0 && convertible.length === 0) {
        toast.success('All feeds are healthy!');
      } else {
        const messages = [];
        if (health.dead.length > 0) {
          messages.push(`${health.dead.length} dead feed${health.dead.length > 1 ? 's' : ''}`);
        }
        if (convertible.length > 0) {
          messages.push(`${convertible.length} feed${convertible.length > 1 ? 's' : ''} can be converted`);
        }
        toast.info(`Found ${messages.join(' and ')}`);
      }
    } catch (error) {
      console.error('Error checking feed health:', error);
      toast.error('Failed to check feed health');
    } finally {
      setIsCheckingHealth(false);
    }
  };

  const handleRemoveDeadFeeds = async () => {
    const totalSelected = selectedDeadFeeds.size + selectedProblematicFeeds.size;
    if (totalSelected === 0) {
      toast.error('No feeds selected');
      return;
    }

    try {
      // Combine both dead and problematic feed IDs
      const feedIds = [
        ...Array.from(selectedDeadFeeds),
        ...Array.from(selectedProblematicFeeds)
      ];
      
      const deletedCount = await FeedHealthService.removeDeadFeeds(feedIds);
      
      toast.success(`Removed ${deletedCount} feed${deletedCount > 1 ? 's' : ''}`);
      
      // Refresh the health check
      await handleCheckFeedHealth();
      setSelectedDeadFeeds(new Set());
      setSelectedProblematicFeeds(new Set());
    } catch (error) {
      console.error('Error removing feeds:', error);
      toast.error('Failed to remove feeds');
    }
  };

  const handleConvertFeeds = async () => {
    if (selectedConvertibleFeeds.size === 0) {
      toast.error('Please select feeds to convert');
      return;
    }
    
    try {
      let convertedCount = 0;
      
      for (const feedId of selectedConvertibleFeeds) {
        const feed = feedHealth?.convertible?.find(f => f.id === feedId);
        if (feed && feed.suggestedType) {
          await FeedHealthService.convertFeedType(feedId, feed.suggestedType);
          convertedCount++;
        }
      }
      
      toast.success(`Converted ${convertedCount} feed${convertedCount > 1 ? 's' : ''}`);
      
      // Refresh the health check and feeds list
      setSelectedConvertibleFeeds(new Set());
      handleCheckFeedHealth();
      
      // Refresh the main feeds list
      const feedsSnapshot = await getDocs(collection(db, 'rssFeeds'));
      setFeeds(feedsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RSSFeed)));
    } catch (error) {
      console.error('Error converting feeds:', error);
      toast.error('Failed to convert feeds');
    }
  };

  return (
    <div className="relative">
      <div>
        <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Feeds Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Track fresh news from RSS and social media sources</p>
        </div>
        
        <div className="flex flex-col items-end gap-2">
          {/* Compact Freshness Filter */}
          <div className="flex items-center gap-3 bg-white dark:bg-gray-900 rounded-lg px-4 py-2 shadow-sm">
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
              Last {freshnessFilter}d
            </span>
            <input
              type="range"
              min="1"
              max="14"
              value={freshnessFilter}
              onChange={(e) => setFreshnessFilter(parseInt(e.target.value))}
              className="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider-compact"
            />
          </div>
          
          {/* Progress Bar */}
          {refreshProgress && (
            <div className="w-full bg-white dark:bg-gray-900 rounded-lg px-4 py-2 shadow-sm">
              <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                <span>Refreshing feeds...</span>
                <span>{refreshProgress.current} / {refreshProgress.total}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-brand-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(refreshProgress.current / refreshProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      {(allCategories.length > 0 || feeds.length > 0) && (
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 mb-6 space-y-3">
          {/* Feed Type Filters */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[60px]">Type:</span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedFeedTypes(new Set())}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedFeedTypes.size === 0
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                All
              </button>
              <button
                onClick={() => toggleFeedType('rss')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  selectedFeedTypes.has('rss')
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M5 3a1 1 0 000 2c5.523 0 10 4.477 10 10a1 1 0 102 0C17 8.373 11.627 3 5 3z"/>
                  <path d="M4 9a1 1 0 011-1 7 7 0 017 7 1 1 0 11-2 0 5 5 0 00-5-5 1 1 0 01-1-1zM3 15a2 2 0 114 0 2 2 0 01-4 0z"/>
                </svg>
                RSS
              </button>
              <button
                onClick={() => toggleFeedType('twitter')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  selectedFeedTypes.has('twitter')
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                Twitter
              </button>
              <button
                onClick={() => toggleFeedType('youtube')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  selectedFeedTypes.has('youtube')
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                YouTube
              </button>
              <button
                onClick={() => toggleFeedType('googlenews')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  selectedFeedTypes.has('googlenews')
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M22 6v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2h16c1.1 0 2 .9 2 2zm-2 0l-8 5-8-5v12h16V6zm-8 3l8-5H4l8 5z"/>
                </svg>
                Google News
              </button>
            </div>
          </div>

          {/* Category Filters */}
          {allCategories.length > 0 && (
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[60px]">Category:</span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedCategories(new Set())}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedCategories.size === 0
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  All
                </button>
                {allCategories.map((category) => (
                  <button
                    key={category}
                    onClick={() => toggleCategory(category)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      selectedCategories.has(category)
                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Sorting and Display Options */}
          <div className="flex items-center gap-4 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'order' | 'recent' | 'name')}
                className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400"
              >
                <option value="order">Custom Order</option>
                <option value="recent">Recently Added</option>
                <option value="name">Alphabetical</option>
              </select>
            </div>
            
            {/* Search Bar */}
            <div className="flex-1 max-w-xs">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search feeds..."
                  className="w-full pl-8 pr-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 placeholder-gray-500 dark:placeholder-gray-400"
                />
                <svg className="absolute left-2.5 top-2 w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 ml-auto">
              <input
                type="checkbox"
                id="hideEmpty"
                checked={hideEmptyFeeds}
                onChange={(e) => setHideEmptyFeeds(e.target.checked)}
                className="w-4 h-4 text-brand-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-brand-500 dark:focus:ring-brand-400"
              />
              <label htmlFor="hideEmpty" className="text-sm text-gray-700 dark:text-gray-300">
                Hide empty feeds
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Sample Feeds */}
      {feeds.length === 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 mb-8">
          <h3 className="text-lg font-medium text-blue-900 dark:text-blue-100 mb-3">Quick Start</h3>
          <p className="text-sm text-blue-700 dark:text-blue-200 mb-4">Add popular RSS feeds to get started:</p>
          <div className="flex flex-wrap gap-2">
            {sampleFeeds.map((sample) => (
              <button
                key={sample.url}
                onClick={async () => {
                  try {
                    // Fetch the feed data first
                    const feedData = await RSSService.fetchFeed(sample.url);
                    
                    const docRef = await addDoc(collection(db, 'rssFeeds'), cleanFirestoreData({
                      ...sample,
                      order: feeds.length,
                      lastFetched: new Date(),
                      createdAt: new Date(),
                      items: feedData.items.slice(0, 10),
                    }));
                    
                    // Update feed items
                    await RSSService.updateFeedItems(docRef.id, feedData);
                    
                    toast.success(`${sample.title} feed added successfully!`);
                  } catch (error) {
                    console.error('Error adding sample feed:', error);
                    toast.error(`Failed to add ${sample.title} feed`);
                  }
                }}
                className="px-3 py-1.5 bg-white dark:bg-gray-800 text-sm rounded-lg hover:shadow-md transition-all"
              >
                + {sample.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* RSS Feeds Grid */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            Your Feeds 
            {(filteredFeeds.length !== feeds.length || searchQuery) && (
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
                {searchQuery ? `(${filteredFeeds.length} results for "${searchQuery}")` : `(${filteredFeeds.length} of ${feeds.length})`}
              </span>
            )}
          </h2>
          <div className="flex gap-3">
            {feeds.length > 0 && (
              <>
                {/* View Mode Toggle */}
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-1 flex">
                  <button
                    onClick={() => setViewMode('card')}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      viewMode === 'card'
                        ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                    title="Card view"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      viewMode === 'list'
                        ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                    title="List view"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                </div>
                <button
                  onClick={refreshFilteredFeeds}
                  disabled={isRefreshing || filteredFeeds.length === 0}
                  className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRefreshing ? (
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  {isRefreshing ? 'Refreshing...' : `Refresh${filteredFeeds.length !== feeds.length ? ` (${filteredFeeds.length})` : ' All'}`}
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="btn-secondary flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Import
                </button>
                <div className="relative export-menu-container">
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export
                  </button>
                  {showExportMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10">
                      <button
                        onClick={() => {
                          exportToJSON();
                          setShowExportMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        Export as JSON
                      </button>
                      <button
                        onClick={() => {
                          exportToOPML();
                          setShowExportMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        Export as OPML
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={async () => {
                    toast.info('Refreshing all feeds...');
                    try {
                      const result = await FeedRefreshService.refreshAllFeeds(true);
                      toast.success(`Refreshed ${result.successCount} feeds`);
                      if (result.failedCount > 0) {
                        toast.error(`${result.failedCount} feeds failed to refresh`);
                      }
                    } catch (error) {
                      toast.error('Failed to refresh feeds');
                    }
                  }}
                  className="btn-secondary flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh All
                </button>
                <button
                  onClick={() => {
                    setShowHealthCheckModal(true);
                    handleCheckFeedHealth();
                  }}
                  className="btn-secondary flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Health Check
                </button>
              </>
            )}
            <button
              onClick={() => setShowAddFeed(true)}
              className="btn-primary flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Feed
            </button>
          </div>
        </div>

        {feeds.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 11-2 0 1 1 0 012 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No feeds yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
              Add RSS, YouTube, or Twitter feeds to track content from your favorite sources
            </p>
          </div>
        ) : viewMode === 'card' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredFeeds.map((feed) => (
              <RSSFeedBlock
                key={feed.id}
                feed={{
                  ...feed,
                  items: filterItemsByFreshness(feed.items)
                }}
                onDelete={handleDeleteFeed}
                onRefresh={handleRefreshFeed}
                onEdit={handleEditFeed}
              />
            ))}
          </div>
        ) : (
          /* List View */
          <div className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Feed Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">URL</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Articles</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Updated</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredFeeds.map((feed) => {
                  const freshItems = filterItemsByFreshness(feed.items);
                  return (
                  <tr key={feed.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center mr-3">
                          {feed.type === 'twitter' ? (
                            <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                            </svg>
                          ) : feed.type === 'youtube' ? (
                            <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 11-2 0 1 1 0 012 0z" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{feed.title}</div>
                          {feed.feedTitle && feed.feedTitle !== feed.title && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">{feed.feedTitle}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {feed.category || 'General'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      <a href={feed.url} target="_blank" rel="noopener noreferrer" className="hover:text-brand-600 dark:hover:text-brand-400">
                        {new URL(feed.url).hostname}
                      </a>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {freshItems.length}
                      {feed.items && feed.items.length > freshItems.length && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
                          (of {feed.items.length})
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(feed.lastFetched, 'datetime')}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditFeed(feed)}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                          title="Edit feed"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleRefreshFeed(feed.id)}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                          title="Refresh feed"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteFeed(feed.id)}
                          className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                          title="Delete feed"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* YouTube Title Generator */}
      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">YouTube Title Ideas</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">AI-generated titles based on trending stories</p>
          </div>
          <button
            onClick={generateYouTubeTitles}
            disabled={isGeneratingTitles || feeds.length === 0}
            className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGeneratingTitles ? (
              <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            )}
            {isGeneratingTitles ? 'Generating...' : 'Generate Titles'}
          </button>
        </div>

        {generatedTitles.length > 0 ? (
          <div className="space-y-3">
            {generatedTitles.map((title, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-gray-800 rounded-lg p-4 flex items-center justify-between group hover:shadow-md transition-all"
              >
                <p className="text-gray-900 dark:text-white font-medium">{title}</p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(title);
                    // You could add a toast notification here
                  }}
                  className="opacity-0 group-hover:opacity-100 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-all"
                  title="Copy to clipboard"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              {feeds.length === 0 
                ? "Add RSS feeds first to generate YouTube title ideas"
                : "Click \"Generate Titles\" to analyze your RSS feeds and create YouTube title suggestions based on trending topics"
              }
            </p>
          </div>
        )}
      </div>

      {/* Add Feed Modal */}
      {showAddFeed && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {editingFeed ? 'Edit Feed' : 'Add Feed'}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {editingFeed ? 'Update feed settings' : 'Add a new feed to track'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddFeed(false);
                  setEditingFeed(null);
                  setFeedUrl('');
                  setFeedTitle('');
                  setFeedCategory('');
                  setTwitterUsername('');
                  setYoutubeUrl('');
                  setGoogleNewsQuery('');
                  setFeedType('rss');
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={editingFeed ? handleUpdateFeed : handleAddFeed}>
              <div className="space-y-4">
                {/* Feed Type Selection - Only show when adding new feed */}
                {!editingFeed && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Feed Type
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => setFeedType('rss')}
                        className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                          feedType === 'rss'
                            ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 11-2 0 1 1 0 012 0z" />
                          </svg>
                          RSS Feed
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFeedType('twitter')}
                        className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                          feedType === 'twitter'
                            ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                          </svg>
                          X (Twitter)
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFeedType('youtube')}
                        className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                          feedType === 'youtube'
                            ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                          </svg>
                          YouTube
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFeedType('googlenews')}
                        className={`py-2 px-3 rounded-lg font-medium transition-colors ${
                          feedType === 'googlenews'
                            ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M20.925 3.641H3.863L20.925 20.7V3.641zM0 3.641C0 1.63 1.631 0 3.641 0h17.284c2.01 0 3.641 1.63 3.641 3.641v17.284c0 2.01-1.631 3.641-3.641 3.641H3.641C1.631 24.566 0 22.935 0 20.925V3.641z"/>
                            <path d="M6.5 7h11v2h-11zm0 4h11v2h-11zm0 4h7v2h-7z"/>
                          </svg>
                          <span className="hidden sm:inline">Google</span>
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Feed Title
                  </label>
                  <input
                    type="text"
                    placeholder={feedType === 'rss' ? "e.g., TechCrunch" : feedType === 'twitter' ? "e.g., Elon Musk's Tweets" : feedType === 'youtube' ? "e.g., MrBeast Channel" : "e.g., Supreme Court News"}
                    value={feedTitle}
                    onChange={(e) => setFeedTitle(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent text-gray-900 dark:text-white"
                    required
                  />
                </div>
                
                {feedType === 'rss' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      RSS Feed URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://example.com/feed.xml"
                      value={feedUrl}
                      onChange={(e) => setFeedUrl(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                ) : feedType === 'twitter' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Twitter Username
                    </label>
                    <input
                      type="text"
                      placeholder="@username, username, or full URL"
                      value={twitterUsername}
                      onChange={(e) => setTwitterUsername(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent text-gray-900 dark:text-white"
                      required
                    />
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Examples: @elonmusk, elonmusk, or https://twitter.com/elonmusk
                    </p>
                    <details className="mt-2">
                      <summary className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                        Getting rate limited? Click for alternative
                      </summary>
                      <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs text-gray-600 dark:text-gray-400 space-y-2">
                        <p><strong>To avoid X/Twitter rate limits, use Apify:</strong></p>
                        <ol className="list-decimal list-inside space-y-1 ml-2">
                          <li>Sign up at <a href="https://console.apify.com" target="_blank" rel="noopener noreferrer" className="underline">console.apify.com</a></li>
                          <li>Get your API token from Account → Integrations</li>
                          <li>Add <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">APIFY_TOKEN=your_token</code> to .env.local</li>
                          <li>Restart your app - it will automatically use Apify</li>
                        </ol>
                        <p className="mt-2 text-xs">
                          Apify provides more reliable access and avoids rate limits. Falls back to official API if not configured.
                        </p>
                      </div>
                    </details>
                  </div>
                ) : feedType === 'youtube' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      YouTube Channel
                    </label>
                    <input
                      type="text"
                      placeholder="@handle, channel name, or URL"
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent text-gray-900 dark:text-white"
                      required
                    />
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Examples: @MrBeast, MrBeast, mkbhd, or full YouTube URL
                    </p>
                    <details className="mt-2">
                      <summary className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                        Having trouble? Click for help
                      </summary>
                      <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs text-gray-600 dark:text-gray-400 space-y-2">
                        <p><strong>To find a channel ID manually:</strong></p>
                        <ol className="list-decimal list-inside space-y-1 ml-2">
                          <li>Go to the YouTube channel</li>
                          <li>Right-click → "View Page Source"</li>
                          <li>Search for "channelId" or "UC"</li>
                          <li>Copy the ID (starts with UC, 24 characters)</li>
                        </ol>
                        <p className="mt-2">
                          <a 
                            href="https://www.youtube.com/account_advanced" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="underline hover:text-gray-700 dark:hover:text-gray-300"
                          >
                            Or find your own channel ID here
                          </a>
                        </p>
                      </div>
                    </details>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Search Query
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., u.s. supreme court, climate change news"
                      value={googleNewsQuery}
                      onChange={(e) => setGoogleNewsQuery(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent text-gray-900 dark:text-white"
                      required
                    />
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Enter search terms to get Google News results filtered by the time slider
                    </p>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Category (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Technology, News, Sports"
                    value={feedCategory}
                    onChange={(e) => setFeedCategory(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddFeed(false);
                    setEditingFeed(null);
                    setFeedUrl('');
                    setFeedTitle('');
                    setFeedCategory('');
                    setTwitterUsername('');
                    setYoutubeUrl('');
                    setGoogleNewsQuery('');
                    setFeedType('rss');
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex items-center gap-2"
                  disabled={isAddingFeed}
                >
                  {isAddingFeed ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {editingFeed ? 'Updating...' : 'Adding Feed...'}
                    </>
                  ) : (
                    editingFeed ? 'Update Feed' : 'Add Feed'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import OPML Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Import OPML
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Import feeds from an OPML file
                </p>
              </div>
              {!importProgress && (
                <button
                  type="button"
                  onClick={() => {
                    setShowImportModal(false);
                    setImportResults(null);
                    setValidateOnImport(false);
                  }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {!importProgress && !importResults && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center">
                  <input
                    type="file"
                    accept=".opml,.xml"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleImportOPML(file);
                      }
                    }}
                    className="hidden"
                    id="opml-file-input"
                  />
                  <label htmlFor="opml-file-input" className="cursor-pointer">
                    <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-gray-700 dark:text-gray-300 font-medium mb-2">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      OPML files only (.opml, .xml)
                    </p>
                  </label>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Supported sources:</p>
                  <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <li>• Feedly OPML exports</li>
                    <li>• Inoreader OPML exports</li>
                    <li>• NewsBlur OPML exports</li>
                    <li>• Any standard OPML 2.0 file</li>
                  </ul>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-3">
                    Large imports are processed in batches to prevent errors
                  </p>
                </div>

                <div className="flex items-center gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <input
                    type="checkbox"
                    id="validate-on-import"
                    checked={validateOnImport}
                    onChange={(e) => setValidateOnImport(e.target.checked)}
                    className="w-4 h-4 text-brand-600 bg-gray-100 border-gray-300 rounded focus:ring-brand-500 dark:focus:ring-brand-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <label htmlFor="validate-on-import" className="flex-1 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                    <span className="font-medium">Validate feeds during import</span>
                    <span className="block text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                      When enabled, attempts to fetch each feed to verify it works. Disable this if imports are failing due to network issues or paywalled feeds.
                    </span>
                  </label>
                </div>
              </div>
            )}

            {importProgress && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Importing feeds...</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {importProgress.current} / {importProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-brand-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                    />
                  </div>
                </div>

                {importResults && (
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">{importResults.success}</p>
                      <p className="text-xs text-green-700 dark:text-green-300">Imported</p>
                    </div>
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
                      <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{importResults.skipped}</p>
                      <p className="text-xs text-yellow-700 dark:text-yellow-300">Skipped</p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400">{importResults.failed}</p>
                      <p className="text-xs text-red-700 dark:text-red-300">Failed</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {importResults && importProgress && importProgress.current === importProgress.total && (
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportProgress(null);
                    setImportResults(null);
                    setValidateOnImport(false);
                  }}
                  className="btn-primary"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Feed Health Check Modal */}
      {showHealthCheckModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Feed Health Check
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Identify and remove dead or problematic feeds
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowHealthCheckModal(false);
                  setFeedHealth(null);
                  setSelectedDeadFeeds(new Set());
                  setSelectedProblematicFeeds(new Set());
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {isCheckingHealth ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <svg className="animate-spin h-12 w-12 text-brand-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-gray-600 dark:text-gray-400">Checking feed health...</p>
                </div>
              </div>
            ) : feedHealth ? (
              <div className="flex-1 overflow-y-auto space-y-6">
                {/* Summary */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">{feedHealth.healthy.length}</p>
                    <p className="text-sm text-green-700 dark:text-green-300">Healthy Feeds</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{feedHealth.convertible?.length || 0}</p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">Can Convert</p>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                    <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{feedHealth.problematic.length}</p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">Problematic</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                    <p className="text-3xl font-bold text-red-600 dark:text-red-400">{feedHealth.dead.length}</p>
                    <p className="text-sm text-red-700 dark:text-red-300">Dead Feeds</p>
                  </div>
                </div>

                {/* Dead Feeds List */}
                {feedHealth.dead.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900 dark:text-white">Dead Feeds</h4>
                      <button
                        onClick={() => {
                          if (selectedDeadFeeds.size === feedHealth.dead.length) {
                            setSelectedDeadFeeds(new Set());
                          } else {
                            setSelectedDeadFeeds(new Set(feedHealth.dead.map(f => f.id)));
                          }
                        }}
                        className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400"
                      >
                        {selectedDeadFeeds.size === feedHealth.dead.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {feedHealth.dead.map((feed) => (
                        <div
                          key={feed.id}
                          className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg"
                        >
                          <input
                            type="checkbox"
                            checked={selectedDeadFeeds.has(feed.id)}
                            onChange={(e) => {
                              const newSelected = new Set(selectedDeadFeeds);
                              if (e.target.checked) {
                                newSelected.add(feed.id);
                              } else {
                                newSelected.delete(feed.id);
                              }
                              setSelectedDeadFeeds(newSelected);
                            }}
                            className="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500"
                          />
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 dark:text-white">{feed.title}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{feed.reason}</p>
                            {feed.lastError && (
                              <p className="text-xs text-red-600 dark:text-red-400 mt-1">Error: {feed.lastError}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Problematic Feeds List */}
                {feedHealth.problematic.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900 dark:text-white">Problematic Feeds</h4>
                      <button
                        onClick={() => {
                          if (selectedProblematicFeeds.size === feedHealth.problematic.length) {
                            setSelectedProblematicFeeds(new Set());
                          } else {
                            setSelectedProblematicFeeds(new Set(feedHealth.problematic.map(f => f.id)));
                          }
                        }}
                        className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400"
                      >
                        {selectedProblematicFeeds.size === feedHealth.problematic.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {feedHealth.problematic.map((feed) => (
                        <div
                          key={feed.id}
                          className="flex items-center gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg"
                        >
                          <input
                            type="checkbox"
                            checked={selectedProblematicFeeds.has(feed.id)}
                            onChange={(e) => {
                              const newSelected = new Set(selectedProblematicFeeds);
                              if (e.target.checked) {
                                newSelected.add(feed.id);
                              } else {
                                newSelected.delete(feed.id);
                              }
                              setSelectedProblematicFeeds(newSelected);
                            }}
                            className="w-4 h-4 text-yellow-600 bg-gray-100 border-gray-300 rounded focus:ring-yellow-500"
                          />
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 dark:text-white">{feed.title}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {feed.errorCount} error{feed.errorCount > 1 ? 's' : ''}
                            </p>
                            {feed.lastError && (
                              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">Last error: {feed.lastError}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Convertible Feeds List */}
                {feedHealth.convertible && feedHealth.convertible.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900 dark:text-white">Feeds That Can Be Converted</h4>
                      <button
                        onClick={() => {
                          if (selectedConvertibleFeeds.size === feedHealth.convertible?.length) {
                            setSelectedConvertibleFeeds(new Set());
                          } else {
                            setSelectedConvertibleFeeds(new Set(feedHealth.convertible?.map(f => f.id) || []));
                          }
                        }}
                        className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400"
                      >
                        {selectedConvertibleFeeds.size === feedHealth.convertible?.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {feedHealth.convertible.map((feed) => (
                        <div
                          key={feed.id}
                          className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
                        >
                          <input
                            type="checkbox"
                            checked={selectedConvertibleFeeds.has(feed.id)}
                            onChange={(e) => {
                              const newSelected = new Set(selectedConvertibleFeeds);
                              if (e.target.checked) {
                                newSelected.add(feed.id);
                              } else {
                                newSelected.delete(feed.id);
                              }
                              setSelectedConvertibleFeeds(newSelected);
                            }}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 dark:text-white">{feed.title}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Currently: {feed.type || 'RSS'} → Suggested: {feed.suggestedType?.toUpperCase()}
                            </p>
                            {feed.detectedPlatform && (
                              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                Detected: {feed.detectedPlatform}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* Actions */}
            {feedHealth && !isCheckingHealth && (
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowHealthCheckModal(false);
                    setFeedHealth(null);
                    setSelectedDeadFeeds(new Set());
                    setSelectedProblematicFeeds(new Set());
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  Close
                </button>
                {selectedConvertibleFeeds.size > 0 && (
                  <button
                    onClick={handleConvertFeeds}
                    className="btn-primary flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Convert {selectedConvertibleFeeds.size} Selected
                  </button>
                )}
                {(selectedDeadFeeds.size > 0 || selectedProblematicFeeds.size > 0) && (
                  <button
                    onClick={handleRemoveDeadFeeds}
                    className="btn-danger flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Remove {selectedDeadFeeds.size + selectedProblematicFeeds.size} Selected
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}