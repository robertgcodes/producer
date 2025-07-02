import { NextResponse } from 'next/server';

export async function GET() {
  // Only show in development or with proper authentication
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }
  
  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    hasFirebaseServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
    serviceAccountLength: process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.length || 0,
    // Show first 50 chars to verify format
    serviceAccountPreview: process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.substring(0, 50) + '...',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    // List all env var keys (not values)
    allEnvKeys: Object.keys(process.env).filter(key => 
      key.includes('FIREBASE') || 
      key.includes('CRON') || 
      key.includes('VERCEL')
    )
  });
}