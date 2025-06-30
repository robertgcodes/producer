'use client';

import { useState } from 'react';
import { Bundle, ContentItem, BundleFile } from '@/types';
import { HomeTab } from './tabs/HomeTab';
import { StoriesTab } from './tabs/StoriesTab';
import { AssetsTab } from './tabs/AssetsTab';
import { ImagesTab } from './tabs/ImagesTab';
import { VideosTab } from './tabs/VideosTab';
import { ResearchTab } from './tabs/ResearchTab';
import { FilesTab } from './tabs/FilesTab';

interface BundleWorkspaceProps {
  bundle: Bundle;
  stories: ContentItem[];
  files?: BundleFile[];
  onUpdateBundle: (bundleId: string, updates: Partial<Bundle>) => void;
  onAddStory: (story: ContentItem) => void;
  onRemoveStory: (storyId: string) => void;
  onDeleteBundle: (bundleId: string) => void;
  onFilesUpdate?: (files: BundleFile[]) => void;
}

type TabId = 'home' | 'stories' | 'assets' | 'files' | 'images' | 'videos' | 'oppo';

interface Tab {
  id: TabId;
  label: string;
  icon: JSX.Element;
}

const tabs: Tab[] = [
  { 
    id: 'home', 
    label: 'Home',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    )
  },
  { 
    id: 'stories', 
    label: 'Stories',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    )
  },
  { 
    id: 'assets', 
    label: 'Assets',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  },
  { 
    id: 'files', 
    label: 'Files',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    )
  },
  { 
    id: 'images', 
    label: 'Images',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    )
  },
  { 
    id: 'videos', 
    label: 'Videos',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    )
  },
  { 
    id: 'oppo', 
    label: 'Research',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    )
  }
];

export function BundleWorkspace({ 
  bundle, 
  stories, 
  files = [],
  onUpdateBundle, 
  onAddStory, 
  onRemoveStory,
  onDeleteBundle,
  onFilesUpdate 
}: BundleWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<TabId>('home');

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Tab Navigation */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <nav className="flex space-x-1 px-4 pt-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors
                ${activeTab === tab.id
                  ? 'bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white border-b-2 border-brand-600 dark:border-brand-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }
              `}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'home' && (
          <HomeTab 
            bundle={bundle} 
            stories={stories}
            onUpdateBundle={onUpdateBundle}
            onDeleteBundle={onDeleteBundle}
          />
        )}
        
        {activeTab === 'stories' && (
          <StoriesTab 
            bundle={bundle} 
            stories={stories}
            onAddStory={onAddStory}
            onRemoveStory={onRemoveStory}
          />
        )}
        
        {activeTab === 'assets' && (
          <AssetsTab 
            bundle={bundle} 
            stories={stories}
          />
        )}
        
        {activeTab === 'files' && (
          <FilesTab 
            bundleId={bundle.id}
            files={files}
            onFilesUpdate={onFilesUpdate || (() => {})}
          />
        )}
        
        {activeTab === 'images' && (
          <ImagesTab 
            bundle={bundle} 
            stories={stories}
          />
        )}
        
        {activeTab === 'videos' && (
          <VideosTab 
            bundle={bundle} 
            stories={stories}
          />
        )}
        
        {activeTab === 'oppo' && (
          <ResearchTab 
            bundle={bundle} 
            onUpdateBundle={onUpdateBundle}
          />
        )}
      </div>
    </div>
  );
}