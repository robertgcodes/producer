'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { auth, db } from '@/lib/firebase';

export default function TestFirebasePage() {
  const { user, loading } = useAuth();
  const [firebaseStatus, setFirebaseStatus] = useState<string>('Checking...');
  const [dbStatus, setDbStatus] = useState<string>('Checking...');

  useEffect(() => {
    // Test Firebase Auth
    if (auth) {
      setFirebaseStatus('✅ Firebase Auth initialized');
    } else {
      setFirebaseStatus('❌ Firebase Auth failed to initialize');
    }

    // Test Firestore
    if (db) {
      setDbStatus('✅ Firestore initialized');
    } else {
      setDbStatus('❌ Firestore failed to initialize');
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Firebase Test Page
        </h1>
        
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Authentication Status
            </h2>
            <div className="space-y-2">
              <p className="text-gray-600 dark:text-gray-400">
                <strong>Loading:</strong> {loading ? 'Yes' : 'No'}
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                <strong>User:</strong> {user ? user.email : 'Not signed in'}
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                <strong>User ID:</strong> {user?.uid || 'N/A'}
              </p>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Firebase Services
            </h2>
            <div className="space-y-2">
              <p className="text-gray-600 dark:text-gray-400">
                <strong>Auth:</strong> {firebaseStatus}
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                <strong>Firestore:</strong> {dbStatus}
              </p>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Environment Variables
            </h2>
            <div className="space-y-2">
              <p className="text-gray-600 dark:text-gray-400">
                <strong>API Key:</strong> {process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '✅ Set' : '❌ Missing'}
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                <strong>Auth Domain:</strong> {process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? '✅ Set' : '❌ Missing'}
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                <strong>Project ID:</strong> {process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? '✅ Set' : '❌ Missing'}
              </p>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Quick Actions
            </h2>
            <div className="space-x-4">
              <a 
                href="/login" 
                className="btn-primary inline-block"
              >
                Go to Login
              </a>
              <a 
                href="/dashboard" 
                className="btn-secondary inline-block"
              >
                Go to Dashboard
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}