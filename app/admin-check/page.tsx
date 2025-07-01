'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

export default function AdminCheckPage() {
  const { user, userProfile } = useAuth();
  const [debugInfo, setDebugInfo] = useState<any>({});
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  useEffect(() => {
    if (user && userProfile) {
      setDebugInfo({
        userEmail: user.email,
        adminEmail: adminEmail,
        emailsMatch: user.email === adminEmail,
        currentRole: userProfile.role,
        userId: user.uid
      });
    }
  }, [user, userProfile, adminEmail]);

  const forceAdminRole = async () => {
    if (!user) return;
    
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        role: 'admin'
      });
      toast.success('Admin role applied! Please refresh the page.');
    } catch (error) {
      toast.error('Failed to update role');
      console.error(error);
    }
  };

  if (!user || !userProfile) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Admin Status Check</h1>
      
      <div className="card p-6 space-y-4">
        <div>
          <strong>Your Email:</strong> {debugInfo.userEmail}
        </div>
        <div>
          <strong>Admin Email (from env):</strong> {debugInfo.adminEmail || 'NOT SET'}
        </div>
        <div>
          <strong>Emails Match:</strong> {debugInfo.emailsMatch ? '✅ Yes' : '❌ No'}
        </div>
        <div>
          <strong>Current Role:</strong> {debugInfo.currentRole}
        </div>
        <div>
          <strong>User ID:</strong> {debugInfo.userId}
        </div>

        {debugInfo.currentRole !== 'admin' && debugInfo.emailsMatch && (
          <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <p className="mb-4">Your email matches the admin email, but your role is not set to admin. This might be because your profile was created before the admin email was configured.</p>
            <button 
              onClick={forceAdminRole}
              className="btn-primary"
            >
              Apply Admin Role
            </button>
          </div>
        )}

        {debugInfo.currentRole === 'admin' && (
          <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p>✅ You are an admin! You should be able to access /migrate</p>
          </div>
        )}
      </div>
    </div>
  );
}