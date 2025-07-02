import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let adminApp: App;

// Initialize Firebase Admin SDK
if (!getApps().length) {
  // For Vercel deployment, we'll use environment variables
  // instead of a service account file
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  
  if (!projectId) {
    throw new Error('NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set');
  }

  // In production (Vercel), we can use the default credentials
  // which Vercel provides through Application Default Credentials
  if (process.env.NODE_ENV === 'production') {
    adminApp = initializeApp({
      projectId: projectId,
    });
  } else {
    // For local development, you'll need to set up a service account
    // Download from Firebase Console > Project Settings > Service Accounts
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
    if (serviceAccount) {
      adminApp = initializeApp({
        credential: cert(JSON.parse(serviceAccount)),
        projectId: projectId,
      });
    } else {
      // Fallback to regular initialization without credentials
      // This will work for read operations with proper Firestore rules
      adminApp = initializeApp({
        projectId: projectId,
      });
    }
  }
} else {
  adminApp = getApps()[0];
}

export const adminDb = getFirestore(adminApp);
export { adminApp };