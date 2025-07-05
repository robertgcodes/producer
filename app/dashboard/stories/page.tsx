'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { Bundle } from '@/types';
import { FiExternalLink, FiBookmark, FiRefreshCw, FiCalendar, FiLink, FiTag } from 'react-icons/fi';
import { formatDate } from '@/lib/utils/dateHelpers';
import { toast } from 'sonner';

interface StoryWithBundle {
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
  bundleTitle?: string;
  bundleIndex?: number;
}

export default function StoriesPage() {
  const { user } = useAuth();
  const [stories, setStories] = useState<StoryWithBundle[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savedStories, setSavedStories] = useState<Set<string>>(new Set());
  const [filterBundle, setFilterBundle] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'bundle' | 'saved'>('recent');

  // Load bundles
  useEffect(() => {
    if (!user) return;

    const bundlesQuery = query(
      collection(db, 'bundles'),
      where('userId', '==', user.uid),
      orderBy('order', 'asc')
    );

    const unsubscribe = onSnapshot(bundlesQuery, (snapshot) => {
      const bundlesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Bundle[];
      
      setBundles(bundlesData);
    });

    return () => unsubscribe();
  }, [user]);

  // Load all stories from all bundles
  useEffect(() => {
    if (!user || bundles.length === 0) {
      if (!user || (user && bundles.length === 0)) {
        setLoading(false);
      }
      return;
    }

    const bundleIds = bundles.map(b => b.id);
    const storiesQuery = query(
      collection(db, 'bundleItems'),
      where('bundleId', 'in', bundleIds),
      orderBy('pubDate', 'desc')
    );

    const unsubscribe = onSnapshot(storiesQuery, (snapshot) => {
      const storiesData = snapshot.docs.map(doc => {
        const data = doc.data();
        const bundle = bundles.find(b => b.id === data.bundleId);
        const bundleIndex = bundle ? bundles.indexOf(bundle) : -1;
        
        return {
          id: doc.id,
          ...data,
          bundleTitle: bundle?.title,
          bundleIndex,
          addedAt: data.addedAt?.toDate ? data.addedAt.toDate() : (data.addedAt || new Date()),
          pubDate: data.pubDate
        } as StoryWithBundle;
      });
      
      setStories(storiesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, bundles]);

  // Load saved stories from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('savedStories');
    if (saved) {
      setSavedStories(new Set(JSON.parse(saved)));
    }
  }, []);

  const handleSaveStory = (storyId: string) => {
    const newSaved = new Set(savedStories);
    if (newSaved.has(storyId)) {
      newSaved.delete(storyId);
      toast.success('Story unsaved');
    } else {
      newSaved.add(storyId);
      toast.success('Story saved');
    }
    setSavedStories(newSaved);
    localStorage.setItem('savedStories', JSON.stringify(Array.from(newSaved)));
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // Stories are automatically updated via Firestore listeners
    // This is just for visual feedback
    setTimeout(() => {
      setRefreshing(false);
      toast.success('Stories refreshed');
    }, 1000);
  };

  // Filter and sort stories
  const filteredStories = stories
    .filter(story => {
      if (filterBundle === 'all') return true;
      if (filterBundle === 'saved') return savedStories.has(story.id);
      return story.bundleId === filterBundle;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          // Sort by pubDate (most recent first)
          const aDate = new Date(a.pubDate).getTime();
          const bDate = new Date(b.pubDate).getTime();
          return bDate - aDate;
        case 'bundle':
          return (a.bundleTitle || '').localeCompare(b.bundleTitle || '');
        case 'saved':
          const aSaved = savedStories.has(a.id);
          const bSaved = savedStories.has(b.id);
          if (aSaved && !bSaved) return -1;
          if (!aSaved && bSaved) return 1;
          const aDate = new Date(a.pubDate).getTime();
          const bDate = new Date(b.pubDate).getTime();
          return bDate - aDate;
        default:
          return 0;
      }
    });

  if (loading) {
    return (
      <main className="h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-950 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading stories...</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-950 overflow-y-auto">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">All Stories</h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                {filteredStories.length} {filteredStories.length === 1 ? 'story' : 'stories'} from your bundles
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <FiRefreshCw className={`w-4 h-4 text-gray-700 dark:text-gray-300 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Filter by Bundle
              </label>
              <select
                value={filterBundle}
                onChange={(e) => setFilterBundle(e.target.value)}
                className="px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="all">All Bundles</option>
                <option value="saved">Saved Stories</option>
                {bundles.map(bundle => (
                  <option key={bundle.id} value={bundle.id}>
                    {bundle.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Sort by
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="recent">Most Recent</option>
                <option value="bundle">Bundle</option>
                <option value="saved">Saved First</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stories Feed */}
        {filteredStories.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              {filterBundle === 'saved' 
                ? 'No saved stories yet. Click the bookmark icon on any story to save it.'
                : 'No stories found. Add some stories to your bundles to see them here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredStories.map((story) => (
              <div
                key={story.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Thumbnail */}
                  {story.thumbnail && (
                    <div className="flex-shrink-0">
                      <img
                        src={story.thumbnail}
                        alt=""
                        className="w-32 h-20 object-cover rounded-lg"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2">
                        {story.title}
                      </h3>
                      <button
                        onClick={() => handleSaveStory(story.id)}
                        className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
                          savedStories.has(story.id)
                            ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20'
                            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                        }`}
                      >
                        <FiBookmark className={`w-5 h-5 ${savedStories.has(story.id) ? 'fill-current' : ''}`} />
                      </button>
                    </div>

                    {story.contentSnippet && (
                      <p className="text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                        {story.contentSnippet}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-sm">
                      {/* Bundle Tag */}
                      <div 
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          story.bundleIndex !== undefined && story.bundleIndex >= 0
                            ? [
                                'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
                                'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
                                'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
                                'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
                                'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
                                'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400',
                                'bg-pink-100 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400',
                                'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
                              ][story.bundleIndex % 8]
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
                        }`}
                      >
                        <FiTag className="w-3 h-3" />
                        {story.bundleTitle || 'Unknown Bundle'}
                      </div>

                      {/* Source */}
                      <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                        <FiLink className="w-4 h-4" />
                        <span>{story.link ? new URL(story.link).hostname.replace('www.', '') : story.feedTitle || 'Unknown'}</span>
                      </div>

                      {/* Date */}
                      <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                        <FiCalendar className="w-4 h-4" />
                        <span>{formatDate(new Date(story.pubDate), 'relative')}</span>
                      </div>

                      {/* View Link */}
                      <a
                        href={story.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto flex items-center gap-1 text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                      >
                        <span>Read</span>
                        <FiExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}