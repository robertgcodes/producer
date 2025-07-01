'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  collection, 
  getDocs, 
  updateDoc, 
  doc, 
  writeBatch,
  query,
  where
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

export default function MigratePage() {
  const { user, userProfile } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<string[]>([]);

  const addResult = (message: string) => {
    setResults(prev => [...prev, message]);
  };

  const runMigration = async () => {
    if (!user || userProfile?.role !== 'admin') {
      toast.error('Only admin users can run migrations');
      return;
    }

    setIsRunning(true);
    setResults([]);
    
    try {
      addResult('Starting data migration...');
      addResult(`Your user ID: ${user.uid}`);
      
      // Migrate projects
      addResult('\n📁 Migrating projects...');
      const projectsSnapshot = await getDocs(collection(db, 'projects'));
      let projectCount = 0;
      
      for (const projectDoc of projectsSnapshot.docs) {
        const data = projectDoc.data();
        if (!data.userId) {
          await updateDoc(doc(db, 'projects', projectDoc.id), {
            userId: user.uid
          });
          projectCount++;
          addResult(`  ✓ Migrated project: ${data.name || projectDoc.id}`);
        }
      }
      addResult(`  Total projects migrated: ${projectCount}`);
      
      // Migrate bundles
      addResult('\n📦 Migrating bundles...');
      const bundlesSnapshot = await getDocs(collection(db, 'bundles'));
      let bundleCount = 0;
      
      const bundleBatch = writeBatch(db);
      const bundleNames: string[] = [];
      
      for (const bundleDoc of bundlesSnapshot.docs) {
        const data = bundleDoc.data();
        if (!data.userId) {
          bundleBatch.update(doc(db, 'bundles', bundleDoc.id), {
            userId: user.uid
          });
          bundleCount++;
          bundleNames.push(data.title || bundleDoc.id);
        }
      }
      
      if (bundleCount > 0) {
        await bundleBatch.commit();
        bundleNames.forEach(name => addResult(`  ✓ Migrated bundle: ${name}`));
      }
      addResult(`  Total bundles migrated: ${bundleCount}`);
      
      // Migrate RSS feeds
      addResult('\n📡 Migrating RSS feeds...');
      const feedsSnapshot = await getDocs(collection(db, 'rssFeeds'));
      let feedCount = 0;
      
      const feedBatch = writeBatch(db);
      const feedNames: string[] = [];
      
      for (const feedDoc of feedsSnapshot.docs) {
        const data = feedDoc.data();
        if (!data.userId) {
          feedBatch.update(doc(db, 'rssFeeds', feedDoc.id), {
            userId: user.uid
          });
          feedCount++;
          feedNames.push(data.title || feedDoc.id);
        }
      }
      
      if (feedCount > 0) {
        await feedBatch.commit();
        feedNames.forEach(name => addResult(`  ✓ Migrated feed: ${name}`));
      }
      addResult(`  Total feeds migrated: ${feedCount}`);
      
      // Check for orphaned content items (optional - just for info)
      addResult('\n📄 Checking content items...');
      const contentSnapshot = await getDocs(collection(db, 'contentItems'));
      const orphanedCount = contentSnapshot.docs.filter(doc => !doc.data().userId).length;
      if (orphanedCount > 0) {
        addResult(`  ⚠️ Found ${orphanedCount} content items without userId (these inherit from their bundles)`);
      }
      
      addResult('\n✅ Migration complete!');
      addResult(`Total items migrated: ${projectCount + bundleCount + feedCount}`);
      
      toast.success('Migration completed successfully!');
      
    } catch (error) {
      console.error('Migration failed:', error);
      addResult(`\n❌ Migration failed: ${error}`);
      toast.error('Migration failed. Check console for details.');
    } finally {
      setIsRunning(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Please log in to continue</p>
      </div>
    );
  }

  if (userProfile?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p>Only admin users can access the migration tool.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Data Migration Tool</h1>
        
        <div className="card p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Migrate Existing Data</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            This tool will add your user ID to all existing data that doesn't have one, 
            making it visible in the new multi-tenant system.
          </p>
          
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Important:</strong> This will modify all projects, bundles, and feeds 
              that don't have a userId field, assigning them to your account.
            </p>
          </div>
          
          <button
            onClick={runMigration}
            disabled={isRunning}
            className="btn-primary"
          >
            {isRunning ? 'Running Migration...' : 'Run Migration'}
          </button>
        </div>
        
        {results.length > 0 && (
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">Migration Results</h3>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 font-mono text-sm">
              {results.map((result, index) => (
                <div key={index} className="whitespace-pre-wrap">
                  {result}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}