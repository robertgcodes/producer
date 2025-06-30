import { NextResponse } from 'next/server';
import { auth } from '@/lib/firebase';

export async function GET() {
  try {
    // Test Firebase configuration
    const config = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'Set' : 'Missing',
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'Missing',
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'Missing',
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'Missing',
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || 'Missing',
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ? 'Set' : 'Missing',
    };

    // Check if auth is initialized
    const authStatus = auth ? 'Initialized' : 'Not initialized';
    
    // Get current auth settings
    const authSettings = {
      currentUser: auth.currentUser ? auth.currentUser.email : 'No user',
      languageCode: auth.languageCode,
      tenantId: auth.tenantId,
    };

    return NextResponse.json({
      status: 'Firebase test endpoint',
      config,
      authStatus,
      authSettings,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({
      error: 'Firebase test failed',
      message: error.message,
      code: error.code,
    }, { status: 500 });
  }
}