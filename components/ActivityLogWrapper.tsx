'use client';

import { useAuth } from '@/contexts/AuthContext';
import { ActivityLog } from '@/components/ActivityLog';

export function ActivityLogWrapper() {
  const { user } = useAuth();
  
  // Only show activity log when user is logged in
  if (!user) {
    return null;
  }
  
  return <ActivityLog />;
}