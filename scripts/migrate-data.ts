import { 
  collection, 
  getDocs, 
  updateDoc, 
  doc, 
  query, 
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';

// IMPORTANT: Replace this with your actual email address
const ADMIN_EMAIL = 'your-email@example.com';

async function migrateData() {
  console.log('Starting data migration...');
  
  try {
    // First, get your user ID from the users collection
    const usersQuery = query(collection(db, 'users'), where('email', '==', ADMIN_EMAIL));
    const userSnapshot = await getDocs(usersQuery);
    
    if (userSnapshot.empty) {
      console.error(`No user found with email: ${ADMIN_EMAIL}`);
      console.log('Please update ADMIN_EMAIL in this script with your actual email address');
      return;
    }
    
    const userId = userSnapshot.docs[0].id;
    console.log(`Found user ID: ${userId}`);
    
    // Migrate projects
    console.log('\nMigrating projects...');
    const projectsSnapshot = await getDocs(collection(db, 'projects'));
    let projectCount = 0;
    
    for (const projectDoc of projectsSnapshot.docs) {
      if (!projectDoc.data().userId) {
        await updateDoc(doc(db, 'projects', projectDoc.id), {
          userId: userId
        });
        projectCount++;
      }
    }
    console.log(`Migrated ${projectCount} projects`);
    
    // Migrate bundles
    console.log('\nMigrating bundles...');
    const bundlesSnapshot = await getDocs(collection(db, 'bundles'));
    let bundleCount = 0;
    
    const bundleBatch = writeBatch(db);
    for (const bundleDoc of bundlesSnapshot.docs) {
      if (!bundleDoc.data().userId) {
        bundleBatch.update(doc(db, 'bundles', bundleDoc.id), {
          userId: userId
        });
        bundleCount++;
      }
    }
    await bundleBatch.commit();
    console.log(`Migrated ${bundleCount} bundles`);
    
    // Migrate RSS feeds
    console.log('\nMigrating RSS feeds...');
    const feedsSnapshot = await getDocs(collection(db, 'rssFeeds'));
    let feedCount = 0;
    
    const feedBatch = writeBatch(db);
    for (const feedDoc of feedsSnapshot.docs) {
      if (!feedDoc.data().userId) {
        feedBatch.update(doc(db, 'rssFeeds', feedDoc.id), {
          userId: userId
        });
        feedCount++;
      }
    }
    await feedBatch.commit();
    console.log(`Migrated ${feedCount} feeds`);
    
    // Migrate sources (if any)
    console.log('\nMigrating sources...');
    const sourcesSnapshot = await getDocs(collection(db, 'sources'));
    let sourceCount = 0;
    
    const sourceBatch = writeBatch(db);
    for (const sourceDoc of sourcesSnapshot.docs) {
      if (!sourceDoc.data().userId) {
        sourceBatch.update(doc(db, 'sources', sourceDoc.id), {
          userId: userId
        });
        sourceCount++;
      }
    }
    await sourceBatch.commit();
    console.log(`Migrated ${sourceCount} sources`);
    
    console.log('\n✅ Migration complete!');
    console.log(`Total items migrated: ${projectCount + bundleCount + feedCount + sourceCount}`);
    
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// Run the migration
migrateData();