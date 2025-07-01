'use client';

import { useState, useEffect, useRef } from 'react';
import { Bundle, ContentItem } from '@/types';
import { toast } from 'sonner';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { compressImage } from '@/lib/utils/imageHelpers';

interface HomeTabProps {
  bundle: Bundle;
  stories: ContentItem[];
  onUpdateBundle: (bundleId: string, updates: Partial<Bundle>) => void;
  onDeleteBundle: (bundleId: string) => void;
}

interface RSSFeed {
  id: string;
  title: string;
  url?: string;
  type?: 'rss' | 'twitter' | 'youtube' | 'googlenews';
  category?: string;
  feedTitle?: string;
  lastFetched?: Date;
  items?: any[];
  twitterUsername?: string;
  youtubeChannelId?: string;
  youtubeUrl?: string;
  googleNewsQuery?: string;
}

// Icon options for bundles
const ICON_OPTIONS = [
  // People
  { emoji: '👤', label: 'Person' },
  { emoji: '👥', label: 'People' },
  { emoji: '👨‍⚖️', label: 'Judge' },
  { emoji: '👮', label: 'Police' },
  { emoji: '🕵️', label: 'Detective' },
  { emoji: '👨‍💼', label: 'Business Person' },
  { emoji: '👩‍💼', label: 'Business Woman' },
  
  // Government/Legal
  { emoji: '⚖️', label: 'Justice/Court' },
  { emoji: '🏛️', label: 'Government' },
  { emoji: '🏢', label: 'Office Building' },
  { emoji: '🏦', label: 'Bank/Institution' },
  { emoji: '📜', label: 'Document' },
  { emoji: '📋', label: 'Clipboard' },
  { emoji: '🔨', label: 'Gavel' },
  
  // Politics
  { emoji: '🗳️', label: 'Ballot Box' },
  { emoji: '🎙️', label: 'Microphone' },
  { emoji: '📢', label: 'Megaphone' },
  { emoji: '🏴', label: 'Flag' },
  { emoji: '🇺🇸', label: 'US Flag' },
  
  // Topics/Categories
  { emoji: '💰', label: 'Money' },
  { emoji: '💵', label: 'Dollar' },
  { emoji: '📊', label: 'Chart' },
  { emoji: '📈', label: 'Trending Up' },
  { emoji: '🔍', label: 'Search' },
  { emoji: '📰', label: 'Newspaper' },
  { emoji: '📺', label: 'Television' },
  { emoji: '🌐', label: 'Globe' },
  { emoji: '🔥', label: 'Hot Topic' },
  { emoji: '⚡', label: 'Breaking' },
  { emoji: '💡', label: 'Idea' },
  { emoji: '🎯', label: 'Target' },
  
  // Other
  { emoji: '📁', label: 'Folder' },
  { emoji: '📌', label: 'Pin' },
  { emoji: '🔖', label: 'Bookmark' },
  { emoji: '⭐', label: 'Star' },
  { emoji: '❗', label: 'Important' },
  { emoji: '🚨', label: 'Alert' },
];

export function HomeTab({ bundle, stories, onUpdateBundle, onDeleteBundle }: HomeTabProps) {
  const [notes, setNotes] = useState(bundle.notes || '');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [aiBrief, setAiBrief] = useState<string>('');
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);
  const [availableFeeds, setAvailableFeeds] = useState<RSSFeed[]>([]);
  const [selectedFeedIds, setSelectedFeedIds] = useState<string[]>(bundle.selectedFeedIds || []);
  const [showFeedSelector, setShowFeedSelector] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isInitialMount = useRef(true);
  
  // Calculate number of rows needed based on selected feeds (2 feeds per row)
  const feedRows = Math.max(1, Math.ceil(selectedFeedIds.length / 2));
  
  // New state for editable fields
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(bundle.title);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editDescription, setEditDescription] = useState(bundle.description || '');
  const [searchTerms, setSearchTerms] = useState<string[]>(bundle.searchTerms || []);
  const [newSearchTerm, setNewSearchTerm] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(bundle.icon || '');
  const [showIconPicker, setShowIconPicker] = useState(false);

  // Update local state when bundle prop changes
  useEffect(() => {
    setEditTitle(bundle.title);
    setEditDescription(bundle.description || '');
    setSearchTerms(bundle.searchTerms || []);
    setSelectedFeedIds(bundle.selectedFeedIds || []);
    setNotes(bundle.notes || '');
    setSelectedIcon(bundle.icon || '');
    // Reset the initial mount flag when bundle changes
    isInitialMount.current = true;
  }, [bundle.id]); // Only depend on bundle.id to avoid loops

  // Load available feeds
  useEffect(() => {
    const loadFeeds = async () => {
      try {
        const feedsQuery = query(collection(db, 'rssFeeds'), orderBy('order', 'asc'));
        const snapshot = await getDocs(feedsQuery);
        const feeds = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as RSSFeed));
        setAvailableFeeds(feeds);
      } catch (error) {
        console.error('Error loading feeds:', error);
      }
    };
    loadFeeds();
  }, []);

  // Auto-save notes after 1 second of no typing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (notes !== bundle.notes) {
        onUpdateBundle(bundle.id, { notes });
        // Remove toast to prevent re-renders
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [notes]); // Only depend on notes changing

  // Save selected feeds when they change
  useEffect(() => {
    // Skip initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    // Skip if we're just syncing from bundle prop
    if (JSON.stringify(selectedFeedIds) === JSON.stringify(bundle.selectedFeedIds)) {
      return;
    }
    
    // Only update if there's an actual change from user interaction
    const timer = setTimeout(() => {
      onUpdateBundle(bundle.id, { selectedFeedIds });
      // Don't clear cache - just update the feed selection
    }, 500);
    
    return () => clearTimeout(timer);
  }, [selectedFeedIds]); // Only depend on selectedFeedIds changing

  const generateAIBrief = async () => {
    if (stories.length === 0) {
      toast.error('Add stories to generate a brief');
      return;
    }

    setIsGeneratingBrief(true);
    try {
      const response = await fetch('/api/generate-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bundleTitle: bundle.title,
          bundleDescription: bundle.description,
          stories: stories.slice(0, 10) // Limit to first 10 stories
        })
      });

      if (!response.ok) throw new Error('Failed to generate brief');
      
      const data = await response.json();
      setAiBrief(data.brief);
      
      // Save the brief to the bundle
      onUpdateBundle(bundle.id, { aiBrief: data.brief });
    } catch (error) {
      console.error('Error generating brief:', error);
      toast.error('Failed to generate AI brief');
    } finally {
      setIsGeneratingBrief(false);
    }
  };

  const handleDeleteBundle = () => {
    if (confirm(`Are you sure you want to delete "${bundle.title}"? This action cannot be undone.`)) {
      onDeleteBundle(bundle.id);
      toast.success('Bundle deleted');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    try {
      toast.loading('Compressing image...');
      
      // Compress the image
      const compressedBase64 = await compressImage(file, 400, 400, 0.8);
      
      // Update bundle with compressed image
      onUpdateBundle(bundle.id, { profileImage: compressedBase64 });
      toast.dismiss();
      toast.success('Image uploaded successfully');
    } catch (error) {
      toast.dismiss();
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image. Please try a smaller file.');
    }
  };

  const toggleFeedSelection = (feedId: string) => {
    setSelectedFeedIds(prev => 
      prev.includes(feedId) 
        ? prev.filter(id => id !== feedId)
        : [...prev, feedId]
    );
  };

  // Handlers for editing title and description
  const saveTitle = () => {
    if (editTitle.trim() && editTitle !== bundle.title) {
      onUpdateBundle(bundle.id, { title: editTitle.trim() });
      toast.success('Title updated');
    }
    setIsEditingTitle(false);
  };

  const saveDescription = () => {
    if (editDescription !== bundle.description) {
      onUpdateBundle(bundle.id, { description: editDescription.trim() });
      toast.success('Description updated');
    }
    setIsEditingDescription(false);
  };

  // Handlers for search terms
  const addSearchTerm = () => {
    if (newSearchTerm.trim() && !searchTerms.includes(newSearchTerm.trim())) {
      const updatedTerms = [...searchTerms, newSearchTerm.trim()];
      setSearchTerms(updatedTerms);
      onUpdateBundle(bundle.id, { searchTerms: updatedTerms });
      setNewSearchTerm('');
      toast.success('Search term added');
    }
  };

  const removeSearchTerm = (term: string) => {
    const updatedTerms = searchTerms.filter(t => t !== term);
    setSearchTerms(updatedTerms);
    onUpdateBundle(bundle.id, { searchTerms: updatedTerms });
    toast.success('Search term removed');
  };

  const handleIconSelect = (icon: string) => {
    setSelectedIcon(icon);
    onUpdateBundle(bundle.id, { icon });
    setShowIconPicker(false);
    toast.success('Icon updated');
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto p-8 space-y-8">
        {/* Bundle Header */}
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm">
          <div className="flex items-start gap-6">
            {/* Profile Image */}
            <div className="flex-shrink-0">
              <div className="relative">
                  {bundle.profileImage ? (
                    <img
                      src={bundle.profileImage}
                      alt={bundle.title}
                      className="w-24 h-24 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-2 -right-2 p-1.5 bg-white dark:bg-gray-800 rounded-full shadow-md hover:shadow-lg transition-shadow border border-gray-200 dark:border-gray-700"
                    title="Upload image"
                  >
                    <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
            </div>
            
            {/* Bundle Info */}
            <div className="flex-1">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  {/* Editable Title */}
                  {isEditingTitle ? (
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveTitle();
                          if (e.key === 'Escape') {
                            setEditTitle(bundle.title);
                            setIsEditingTitle(false);
                          }
                        }}
                        className="text-2xl font-bold bg-transparent border-b-2 border-brand-500 outline-none flex-1 text-gray-900 dark:text-white"
                        autoFocus
                      />
                      <button
                        onClick={saveTitle}
                        className="p-1 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          setEditTitle(bundle.title);
                          setIsEditingTitle(false);
                        }}
                        className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <h1 
                      className="text-2xl font-bold text-gray-900 dark:text-white cursor-pointer hover:text-brand-600 dark:hover:text-brand-400 inline-flex items-center gap-2"
                      onClick={() => setIsEditingTitle(true)}
                    >
                      {bundle.title}
                      <svg className="w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </h1>
                  )}
                  
                  {/* Editable Description */}
                  {isEditingDescription ? (
                    <div className="mt-2">
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            setEditDescription(bundle.description || '');
                            setIsEditingDescription(false);
                          }
                        }}
                        className="w-full bg-transparent border border-brand-500 rounded p-2 outline-none resize-none text-gray-900 dark:text-white"
                        rows={2}
                        autoFocus
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={saveDescription}
                          className="btn-primary text-xs"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditDescription(bundle.description || '');
                            setIsEditingDescription(false);
                          }}
                          className="btn-secondary text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p 
                      className="text-gray-600 dark:text-gray-400 mt-1 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200 flex items-start gap-2"
                      onClick={() => setIsEditingDescription(true)}
                    >
                      {bundle.description || 'Click to add description'}
                      <svg className="w-3 h-3 opacity-50 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Icon Selector Button */}
                  <div className="relative">
                    <button
                      onClick={() => setShowIconPicker(!showIconPicker)}
                      className="p-2 text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                      title="Select icon"
                    >
                      {selectedIcon ? (
                        <span className="text-lg">{selectedIcon}</span>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </button>
                    
                    {/* Icon Picker Dropdown */}
                    {showIconPicker && (
                      <div className="absolute top-full mt-2 right-0 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 w-80 max-h-96 overflow-y-auto">
                        <div className="grid grid-cols-8 gap-1">
                          {ICON_OPTIONS.map((option, index) => (
                            <button
                              key={index}
                              onClick={() => handleIconSelect(option.emoji)}
                              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                              title={option.label}
                            >
                              <span className="text-2xl">{option.emoji}</span>
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => handleIconSelect('')}
                          className="mt-2 w-full text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          Remove icon
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Delete Button */}
                  <button
                    onClick={handleDeleteBundle}
                    className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Delete bundle"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* Story Count */}
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span className="text-gray-600 dark:text-gray-400">{stories.length} stories</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-gray-600 dark:text-gray-400">
                    Created {new Date(bundle.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Selected Feeds Section */}
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Bundle Feeds</h2>
            <button
              onClick={() => setShowFeedSelector(!showFeedSelector)}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              {showFeedSelector ? 'Done' : 'Select Feeds'}
            </button>
          </div>

          {/* Feed Selector */}
          {showFeedSelector && (
            <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Select feeds to follow for this bundle:</p>
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {availableFeeds.map(feed => (
                  <label
                    key={feed.id}
                    className="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedFeedIds.includes(feed.id)}
                      onChange={() => toggleFeedSelection(feed.id)}
                      className="w-4 h-4 text-brand-600 bg-gray-100 border-gray-300 rounded focus:ring-brand-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                      {feed.title}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Selected Feeds Display */}
          {selectedFeedIds.length > 0 ? (
            <div>
              {Array.from({ length: feedRows }).map((_, rowIndex) => (
                <div key={rowIndex} className={`grid grid-cols-2 gap-4 ${rowIndex < feedRows - 1 ? 'mb-4' : ''}`}>
                  {selectedFeedIds.slice(rowIndex * 2, (rowIndex + 1) * 2).map(feedId => {
                    const feed = availableFeeds.find(f => f.id === feedId);
                    if (!feed) return null;
                    
                    return (
                      <div key={feedId} className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900 dark:text-white text-sm flex items-center gap-1">
                              {feed.type === 'twitter' && (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                                </svg>
                              )}
                              {feed.type === 'youtube' && (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                                </svg>
                              )}
                              {(!feed.type || feed.type === 'rss') && (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M5 3a1 1 0 000 2c5.523 0 10 4.477 10 10a1 1 0 102 0C17 8.373 11.627 3 5 3z"/>
                                  <path d="M4 9a1 1 0 011-1 7 7 0 017 7 1 1 0 11-2 0 5 5 0 00-5-5 1 1 0 01-1-1zM3 15a2 2 0 114 0 2 2 0 01-4 0z"/>
                                </svg>
                              )}
                              {feed.title}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {feed.type === 'twitter' && feed.twitterUsername ? `@${feed.twitterUsername}` : 
                               feed.type === 'youtube' ? 'YouTube Channel' :
                               feed.type === 'googlenews' && feed.googleNewsQuery ? `Google News: ${feed.googleNewsQuery}` :
                               feed.category || 'General'}
                            </p>
                          </div>
                        </div>
                        
                        {/* Feed Items Preview */}
                        {feed.items && feed.items.length > 0 ? (
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-thin">
                            {feed.items.slice(0, 10).map((item, idx) => (
                              <div key={idx} className="text-xs border-b border-gray-100 dark:border-gray-800 last:border-0 pb-2 last:pb-0">
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
                                        className="w-12 h-7 object-cover rounded flex-shrink-0"
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none';
                                        }}
                                      />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <span className="line-clamp-2 font-medium">{item.title}</span>
                                      {item.pubDate && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                          {(() => {
                                            try {
                                              const date = new Date(item.pubDate);
                                              const now = new Date();
                                              const diff = now.getTime() - date.getTime();
                                              const hours = Math.floor(diff / (1000 * 60 * 60));
                                              const days = Math.floor(hours / 24);
                                              
                                              if (hours < 1) return 'Just now';
                                              if (hours < 24) return `${hours}h ago`;
                                              if (days < 7) return `${days}d ago`;
                                              return date.toLocaleDateString();
                                            } catch (e) {
                                              return '';
                                            }
                                          })()}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </a>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                            No recent items
                          </p>
                        )}
                        
                        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Last updated: {(() => {
                              if (!feed.lastFetched) return 'Never';
                              try {
                                // Handle Firestore Timestamp
                                const date = feed.lastFetched.toDate ? feed.lastFetched.toDate() : new Date(feed.lastFetched);
                                return date.toLocaleDateString();
                              } catch (e) {
                                return 'Never';
                              }
                            })()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <svg className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 11-2 0 1 1 0 012 0z" />
              </svg>
              <p className="text-gray-500 dark:text-gray-400">
                No feeds selected for this bundle
              </p>
              <button
                onClick={() => setShowFeedSelector(true)}
                className="mt-2 text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
              >
                Select feeds to follow
              </button>
            </div>
          )}
        </div>

        {/* AI Brief Section */}
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">AI Brief</h2>
            <button
              onClick={generateAIBrief}
              disabled={isGeneratingBrief || stories.length === 0}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              {isGeneratingBrief ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generate Brief
                </>
              )}
            </button>
          </div>
          
          {aiBrief || bundle.aiBrief ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                {aiBrief || bundle.aiBrief}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <svg className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <p className="text-gray-500 dark:text-gray-400">
                {stories.length === 0 
                  ? 'Add stories to generate an AI brief'
                  : 'Click "Generate Brief" to create an AI summary of your bundle'
                }
              </p>
            </div>
          )}
        </div>

        {/* Notes Section */}
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Notes</h2>
            <button
              onClick={() => setIsEditingNotes(!isEditingNotes)}
              className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
            >
              {isEditingNotes ? 'Done' : 'Edit'}
            </button>
          </div>
          
          {isEditingNotes ? (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add your notes here..."
              className="w-full h-64 px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 resize-none text-gray-900 dark:text-white"
              autoFocus
            />
          ) : (
            <div 
              onClick={() => setIsEditingNotes(true)}
              className="min-h-[100px] p-4 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-text"
            >
              {notes ? (
                <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{notes}</div>
              ) : (
                <p className="text-gray-400 dark:text-gray-500 italic">Click to add notes...</p>
              )}
            </div>
          )}
        </div>

        {/* Search Terms Section */}
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Search Terms</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Additional terms to find related stories (e.g., alternative names, variations)
              </p>
            </div>
          </div>
          
          {/* Add new term */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newSearchTerm}
              onChange={(e) => setNewSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addSearchTerm();
              }}
              placeholder="Add search term..."
              className="input-field flex-1"
            />
            <button
              onClick={addSearchTerm}
              disabled={!newSearchTerm.trim()}
              className="btn-primary"
            >
              Add
            </button>
          </div>
          
          {/* Search terms list */}
          {searchTerms.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded-full text-sm">
                <span className="font-medium">{bundle.title}</span>
                <span className="text-xs opacity-70">(primary)</span>
              </span>
              {searchTerms.map((term, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full text-sm"
                >
                  {term}
                  <button
                    onClick={() => removeSearchTerm(term)}
                    className="ml-1 hover:text-red-600 dark:hover:text-red-400"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
              No additional search terms. The bundle title "{bundle.title}" will be used for searching.
            </p>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stories.filter(s => s.sourceType === 'article').length}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Articles</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stories.filter(s => s.sourceType === 'video').length}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Videos</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
                <svg className="w-6 h-6 text-cyan-600 dark:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stories.filter(s => s.sourceType === 'tweet' || s.sourceType === 'social').length}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Social</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />
    </div>
  );
}