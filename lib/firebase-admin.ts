import { initializeApp, getApps, cert, App, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let adminApp: App;

// Initialize Firebase Admin SDK
if (!getApps().length) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  
  if (!projectId) {
    throw new Error('NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set');
  }

  // Check for service account in environment variable (works for both local and Vercel)
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  
  if (serviceAccountKey) {
    try {
      // Parse the service account JSON
      const serviceAccount = JSON.parse(serviceAccountKey);
      
      adminApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: projectId,
      });
      
      console.log('[Firebase Admin] Initialized with service account');
    } catch (error) {
      console.error('[Firebase Admin] Failed to parse service account:', error);
      throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT_KEY format');
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Use Application Default Credentials (for Google Cloud environments)
    adminApp = initializeApp({
      credential: applicationDefault(),
      projectId: projectId,
    });
    
    console.log('[Firebase Admin] Initialized with Application Default Credentials');
  } else {
    // Fallback: Initialize without credentials
    // This won't work for authenticated operations
    console.warn('[Firebase Admin] No credentials found - initializing without authentication');
    console.warn('[Firebase Admin] Set FIREBASE_SERVICE_ACCOUNT_KEY in Vercel environment variables');
    
    adminApp = initializeApp({
      projectId: projectId,
    });
  }
} else {
  adminApp = getApps()[0];
}

export const adminDb = getFirestore(adminApp);
export { adminApp };