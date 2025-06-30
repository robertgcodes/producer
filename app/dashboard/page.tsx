'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Bundle, ContentItem, Project } from '@/types';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { BundleDashboard } from '@/components/dashboard/BundleDashboard';

export default function DashboardPage() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [bundleStories, setBundleStories] = useState<Record<string, ContentItem[]>>({});
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isLoadingBundles, setIsLoadingBundles] = useState(false);
  const [showNotes, setShowNotes] = useState('');

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      router.push('/login');
      return;
    }

    // Create or get today's project
    const today = new Date();
    const projectName = `${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} Show`;
    
    try {
      const projectsRef = collection(db, 'projects');
      const q = query(projectsRef, where('userId', '==', user.uid));
      
      const unsubscribe = onSnapshot(
        q, 
        (snapshot) => {
          const projectsList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Project));
          
          // Sort projects by createdAt in descending order (most recent first)
          projectsList.sort((a, b) => {
            const aDate = a.createdAt instanceof Date ? a.createdAt : (a.createdAt as any).toDate();
            const bDate = b.createdAt instanceof Date ? b.createdAt : (b.createdAt as any).toDate();
            return bDate.getTime() - aDate.getTime();
          });
          
          setProjects(projectsList);
          setIsLoadingProjects(false);
          
          // Set active project (today's or most recent)
          if (projectsList.length > 0) {
            setActiveProject(projectsList[0]);
          } else {
            // Create first project
            createProject(projectName);
          }
          setFirebaseError(null);
        },
        (error) => {
          console.error('Error fetching projects:', error);
          setFirebaseError(error.message);
          setIsLoadingProjects(false);
        }
      );

      return () => unsubscribe();
    } catch (error: any) {
      console.error('Error setting up projects listener:', error);
      setFirebaseError(error.message);
      setIsLoadingProjects(false);
    }
  }, [user, router, authLoading]);

  useEffect(() => {
    if (!activeProject) return;

    setIsLoadingBundles(true);
    const bundlesRef = collection(db, 'bundles');
    const q = query(bundlesRef, where('projectId', '==', activeProject.id), orderBy('order', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bundlesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Bundle));
      
      setBundles(bundlesList);
      setIsLoadingBundles(false);
      
      // Fetch stories for each bundle
      bundlesList.forEach(bundle => {
        fetchBundleStories(bundle.id);
      });
    });

    return () => unsubscribe();
  }, [activeProject]);

  const fetchBundleStories = async (bundleId: string) => {
    try {
      const storiesRef = collection(db, 'contentItems');
      const q = query(storiesRef, where('bundleId', '==', bundleId));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const stories = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as ContentItem));
        
        // Sort in JavaScript instead
        stories.sort((a, b) => a.order - b.order);
        
        setBundleStories(prev => ({
          ...prev,
          [bundleId]: stories
        }));
      });
    } catch (error) {
      console.error('Error fetching stories:', error);
    }
  };

  const createProject = async (name: string) => {
    if (!user) return;
    
    try {
      const projectData = {
        name,
        date: new Date(),
        status: 'active',
        userId: user.uid,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const docRef = await addDoc(collection(db, 'projects'), projectData);
      console.log('Project created with ID: ', docRef.id);
    } catch (error: any) {
      console.error('Error creating project: ', error);
      setFirebaseError(`Failed to create project: ${error.message}`);
    }
  };

  const handleDeleteStory = async (storyId: string) => {
    if (!confirm('Are you sure you want to delete this story?')) return;
    
    try {
      await deleteDoc(doc(db, 'contentItems', storyId));
    } catch (error) {
      console.error('Error deleting story: ', error);
      alert('Failed to delete story');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Error logging out: ', error);
    }
  };

  // Show loading state
  if (authLoading || isLoadingProjects) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (firebaseError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card max-w-md w-full p-8">
          <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">Connection Error</h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">{firebaseError}</p>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">Please check:</p>
            <ul className="list-disc list-inside text-sm text-yellow-800 dark:text-yellow-200">
              <li>Your Firebase configuration in .env.local</li>
              <li>Firebase project settings and permissions</li>
              <li>Firestore database is enabled in Firebase Console</li>
            </ul>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary w-full"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // Show loading if no active project yet
  if (!activeProject) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Setting up your project...</p>
        </div>
      </div>
    );
  }

  return (
    <BundleDashboard activeProject={activeProject} />
  );
}