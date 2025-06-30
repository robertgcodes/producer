'use client';

import { useState, useEffect, useRef } from 'react';
import { Bundle, ContentItem, Project, BundleFile } from '@/types';
import { BundleSidebar } from './bundles/sidebar/BundleSidebar';
import { BundleWorkspace } from './bundles/BundleWorkspace';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { cleanFirestoreData } from '@/lib/utils/firebaseHelpers';
import { activityLog } from '@/lib/services/activityLogService';
import { RemovedStoriesService } from '@/lib/services/removedStoriesService';

interface BundleDashboardProps {
  activeProject: Project;
}

export function BundleDashboard({ activeProject }: BundleDashboardProps) {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [bundleStories, setBundleStories] = useState<Record<string, ContentItem[]>>({});
  const [bundleFiles, setBundleFiles] = useState<Record<string, BundleFile[]>>({});
  const [activeBundle, setActiveBundle] = useState<string | null>(null);
  const [isLoadingBundles, setIsLoadingBundles] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Track story count updates to prevent loops
  const storyCountTimeouts = useRef<Record<string, NodeJS.Timeout>>({});

  // Load bundles
  useEffect(() => {
    if (!activeProject?.id) return;

    const bundlesQuery = query(
      collection(db, 'bundles'),
      where('projectId', '==', activeProject.id),
      orderBy('order', 'asc')
    );

    const unsubscribe = onSnapshot(bundlesQuery, (snapshot) => {
      const bundlesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as Bundle[];
      
      setBundles(bundlesData);
      setIsLoadingBundles(false);

      // Only set first bundle as active if none selected and no active bundle exists
      setActiveBundle(prevActive => {
        if (!prevActive && bundlesData.length > 0) {
          return bundlesData[0].id;
        }
        // Keep the current active bundle if it still exists
        if (prevActive && bundlesData.some(b => b.id === prevActive)) {
          return prevActive;
        }
        // If current bundle was deleted, select first one
        if (prevActive && !bundlesData.some(b => b.id === prevActive) && bundlesData.length > 0) {
          return bundlesData[0].id;
        }
        return prevActive;
      });
    }, (error) => {
      console.error('Error loading bundles:', error);
      toast.error('Failed to load bundles');
      setIsLoadingBundles(false);
    });

    return () => unsubscribe();
  }, [activeProject?.id]);

  // Load stories and files for bundles
  useEffect(() => {
    if (bundles.length === 0) return;

    const unsubscribes: (() => void)[] = [];

    bundles.forEach(bundle => {
      // Load stories
      const storiesQuery = query(
        collection(db, 'contentItems'),
        where('bundleId', '==', bundle.id),
        orderBy('order', 'asc')
      );

      const unsubscribe = onSnapshot(storiesQuery, (snapshot) => {
        const stories = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          addedAt: doc.data().addedAt?.toDate() || new Date()
        })) as ContentItem[];

        setBundleStories(prev => ({
          ...prev,
          [bundle.id]: stories
        }));

        // Update story count in bundle only if it's different
        // Use a debounced timeout to prevent loops
        if (stories.length !== bundle.storyCount) {
          // Clear existing timeout for this bundle
          if (storyCountTimeouts.current[bundle.id]) {
            clearTimeout(storyCountTimeouts.current[bundle.id]);
          }
          
          // Set new timeout
          storyCountTimeouts.current[bundle.id] = setTimeout(() => {
            updateDoc(doc(db, 'bundles', bundle.id), {
              storyCount: stories.length
            }).catch(error => {
              console.error('Error updating story count:', error);
            });
          }, 2000); // 2 second delay to ensure stability
        }
      });

      unsubscribes.push(unsubscribe);

      // Load files
      const filesQuery = query(
        collection(db, 'bundleFiles'),
        where('bundleId', '==', bundle.id),
        orderBy('order', 'asc')
      );

      const filesUnsubscribe = onSnapshot(filesQuery, (snapshot) => {
        const files = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          uploadedAt: doc.data().uploadedAt?.toDate() || new Date()
        })) as BundleFile[];

        setBundleFiles(prev => ({
          ...prev,
          [bundle.id]: files
        }));
      });

      unsubscribes.push(filesUnsubscribe);
    });

    return () => {
      // Clear all timeouts
      Object.values(storyCountTimeouts.current).forEach(timeout => clearTimeout(timeout));
      storyCountTimeouts.current = {};
      
      // Unsubscribe from listeners
      unsubscribes.forEach(unsub => unsub());
    };
  }, [bundles]);

  const handleCreateBundle = async () => {
    console.log('handleCreateBundle called');
    const title = prompt('Enter bundle title:');
    if (!title) return;
    
    const description = prompt('Enter bundle description (optional):');
    
    try {
      console.log('Creating bundle with projectId:', activeProject.id);
      const bundleData = {
        projectId: activeProject.id,
        title,
        description: description || '',
        theme: 'general',
        priority: 'growing' as const,
        estimatedTime: 30,
        order: bundles.length,
        createdAt: new Date(),
        updatedAt: new Date(),
        storyCount: 0
      };
      
      const docRef = await addDoc(collection(db, 'bundles'), bundleData);
      console.log('Bundle created with ID:', docRef.id);
      setActiveBundle(docRef.id);
      activityLog.success(`Created bundle: ${title}`);
      toast.success('Bundle created successfully');
    } catch (error) {
      console.error('Error creating bundle:', error);
      toast.error('Failed to create bundle');
    }
  };

  const handleCreateChildBundle = async (parentId: string) => {
    const title = prompt('Enter sub-bundle title:');
    if (!title) return;
    
    const description = prompt('Enter sub-bundle description (optional):');
    
    try {
      const parentBundle = bundles.find(b => b.id === parentId);
      const bundleData = {
        projectId: activeProject.id,
        parentId,
        title,
        description: description || '',
        theme: parentBundle?.theme || 'general',
        priority: 'growing' as const,
        estimatedTime: 30,
        order: bundles.filter(b => b.parentId === parentId).length,
        createdAt: new Date(),
        updatedAt: new Date(),
        storyCount: 0
      };
      
      const docRef = await addDoc(collection(db, 'bundles'), bundleData);
      setActiveBundle(docRef.id);
      toast.success('Sub-bundle created successfully');
    } catch (error) {
      console.error('Error creating sub-bundle:', error);
      toast.error('Failed to create sub-bundle');
    }
  };

  const handleUpdateBundle = async (bundleId: string, updates: Partial<Bundle>) => {
    try {
      await updateDoc(doc(db, 'bundles', bundleId), {
        ...updates,
        updatedAt: new Date()
      });
      toast.success('Bundle updated');
    } catch (error) {
      console.error('Error updating bundle:', error);
      toast.error('Failed to update bundle');
    }
  };

  const handleDeleteBundle = async (bundleId: string) => {
    try {
      // Delete all stories in the bundle first
      const stories = bundleStories[bundleId] || [];
      for (const story of stories) {
        await deleteDoc(doc(db, 'stories', story.id));
      }
      
      // Delete the bundle
      // Get bundle title for activity log
      const bundleToDelete = bundles.find(b => b.id === bundleId);
      const bundleTitle = bundleToDelete?.title || 'bundle';
      
      await deleteDoc(doc(db, 'bundles', bundleId));
      
      // Select another bundle if this was active
      if (activeBundle === bundleId) {
        const remainingBundles = bundles.filter(b => b.id !== bundleId);
        setActiveBundle(remainingBundles[0]?.id || null);
      }
      
      activityLog.info(`Deleted bundle: ${bundleTitle}`);
      toast.success('Bundle deleted');
    } catch (error) {
      console.error('Error deleting bundle:', error);
      toast.error('Failed to delete bundle');
    }
  };

  const handleAddStory = async (story: ContentItem) => {
    try {
      console.log('Adding story to bundle:', activeBundle, story);
      if (!activeBundle) {
        toast.error('No bundle selected');
        return;
      }
      
      // Remove the temporary ID and let Firestore generate a new one
      const { id, ...storyWithoutId } = story;
      
      // Clean the story data to remove undefined values
      const storyData = cleanFirestoreData({
        ...storyWithoutId,
        bundleId: activeBundle,
        addedAt: new Date()
      });
      
      await addDoc(collection(db, 'contentItems'), storyData);
      console.log('Story added successfully');
      
      // Get the current bundle title for activity log
      const currentBundleObj = bundles.find(b => b.id === activeBundle);
      const bundleTitle = currentBundleObj?.title || 'bundle';
      activityLog.addStoryToBundle(story.title, bundleTitle);
      
      // Remove toast here as it's handled in the StoriesTab
    } catch (error) {
      console.error('Error adding story:', error);
      toast.error('Failed to add story');
      throw error; // Re-throw to let the caller know it failed
    }
  };

  const handleRemoveStory = async (storyId: string) => {
    try {
      // Get story info before deleting for activity log
      const currentBundleObj = bundles.find(b => b.id === activeBundle);
      const bundleTitle = currentBundleObj?.title || 'bundle';
      const stories = activeBundle ? (bundleStories[activeBundle] || []) : [];
      const story = stories.find(s => s.id === storyId);
      const storyTitle = story?.title || 'story';
      const storyUrl = story?.url || '';
      
      // Mark the story as removed so it won't be re-added
      if (activeBundle && storyUrl) {
        await RemovedStoriesService.markAsRemoved(
          storyId,
          activeBundle,
          activeProject.userId,
          storyUrl
        );
      }
      
      await deleteDoc(doc(db, 'contentItems', storyId));
      activityLog.removeStoryFromBundle(storyTitle, bundleTitle);
      toast.success('Story removed from bundle');
      
    } catch (error) {
      console.error('Error removing story:', error);
      toast.error('Failed to remove story');
      throw error; // Re-throw to let the caller know it failed
    }
  };

  const handleReorderBundles = async (reorderedBundles: Bundle[]) => {
    try {
      // Update order for each bundle in Firestore
      const updatePromises = reorderedBundles.map(bundle => 
        updateDoc(doc(db, 'bundles', bundle.id), { order: bundle.order })
      );
      
      await Promise.all(updatePromises);
      // The real-time listener will automatically update the bundles state
      toast.success('Bundles reordered');
    } catch (error) {
      console.error('Error reordering bundles:', error);
      toast.error('Failed to reorder bundles');
    }
  };

  const handleFilesUpdate = async (bundleId: string, files: BundleFile[]) => {
    // Update order in Firestore
    try {
      const updatePromises = files.map((file, index) => 
        updateDoc(doc(db, 'bundleFiles', file.id), { order: index })
      );
      
      await Promise.all(updatePromises);
      activityLog.success('File order updated');
    } catch (error) {
      console.error('Error updating file order:', error);
      toast.error('Failed to update file order');
    }
  };

  const currentBundle = bundles.find(b => b.id === activeBundle);
  const currentStories = activeBundle ? (bundleStories[activeBundle] || []) : [];

  return (
    <div className="h-[calc(100vh-4rem)] flex overflow-hidden">
      {/* Collapsible Sidebar */}
      <div className={`${isSidebarCollapsed ? 'w-16' : 'w-80'} transition-all duration-300 relative flex-shrink-0`}>
        <BundleSidebar
          bundles={bundles}
          activeBundle={activeBundle}
          onBundleSelect={setActiveBundle}
          onCreateBundle={handleCreateBundle}
          onCreateChildBundle={handleCreateChildBundle}
          onReorderBundles={handleReorderBundles}
        />
        
        {/* Collapse Toggle */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-3 top-8 w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-shadow z-20"
        >
          <svg 
            className={`w-3 h-3 text-gray-600 dark:text-gray-400 transition-transform ${isSidebarCollapsed ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {currentBundle ? (
          <BundleWorkspace
            bundle={currentBundle}
            stories={currentStories}
            files={bundleFiles[currentBundle.id] || []}
            onUpdateBundle={handleUpdateBundle}
            onAddStory={handleAddStory}
            onRemoveStory={handleRemoveStory}
            onDeleteBundle={handleDeleteBundle}
            onFilesUpdate={(files) => handleFilesUpdate(currentBundle.id, files)}
          />
        ) : (
        <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-950">
          <div className="text-center">
            <svg className="w-16 h-16 text-gray-300 dark:text-gray-700 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Bundle Selected</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Create a new bundle or select an existing one to get started
            </p>
            <button
              onClick={handleCreateBundle}
              className="btn-primary"
            >
              Create First Bundle
            </button>
          </div>
        </div>
        )}
      </div>

      {/* Create Bundle Modal would go here */}
    </div>
  );
}