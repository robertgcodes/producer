'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Bundle, ContentItem, Project } from '@/types';
import { InspirationView } from '@/components/dashboard/InspirationView';

export default function InspirationPage() {
  const { user } = useAuth();
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [bundleStories, setBundleStories] = useState<Record<string, ContentItem[]>>({});
  const [activeProject, setActiveProject] = useState<any>(null);

  useEffect(() => {
    if (!user) return;

    // Get today's project
    const projectsRef = collection(db, 'projects');
    const q = query(projectsRef, where('userId', '==', user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];
      
      // Sort projects by createdAt in descending order
      projectsList.sort((a, b) => {
        const aDate = a.createdAt instanceof Date ? a.createdAt : (a.createdAt as any).toDate();
        const bDate = b.createdAt instanceof Date ? b.createdAt : (b.createdAt as any).toDate();
        return bDate.getTime() - aDate.getTime();
      });
      
      if (projectsList.length > 0) {
        setActiveProject(projectsList[0]);
      }
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!activeProject) return;

    const bundlesRef = collection(db, 'bundles');
    const q = query(bundlesRef, where('projectId', '==', activeProject.id), orderBy('order', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bundlesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Bundle));
      
      setBundles(bundlesList);
      
      // Fetch stories for each bundle
      bundlesList.forEach(bundle => {
        fetchBundleStories(bundle.id);
      });
    });

    return () => unsubscribe();
  }, [activeProject]);

  const fetchBundleStories = async (bundleId: string) => {
    const storiesRef = collection(db, 'contentItems');
    const q = query(storiesRef, where('bundleId', '==', bundleId));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const stories = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ContentItem));
      
      stories.sort((a, b) => a.order - b.order);
      
      setBundleStories(prev => ({
        ...prev,
        [bundleId]: stories
      }));
    });
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto p-8">
        <InspirationView bundles={bundles} bundleStories={bundleStories} />
      </div>
    </main>
  );
}