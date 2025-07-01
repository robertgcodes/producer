import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserProfile, UserRole, BundleShare, TeamMember, APIKeyStatus } from '@/types/user';

// Admin email from environment variable
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@watcherpro.ai';

export class UserService {
  static async createUserProfile(uid: string, email: string, displayName?: string): Promise<UserProfile> {
    const now = new Date();
    const isAdmin = email === ADMIN_EMAIL;
    
    const userProfile: UserProfile = {
      uid,
      email,
      displayName: displayName || email.split('@')[0],
      role: isAdmin ? 'admin' : 'user',
      isActive: true,
      createdAt: now,
      updatedAt: now,
      settings: {
        theme: 'system',
        autoRefreshFeeds: true,
        refreshInterval: 30,
        emailNotifications: true,
        defaultProjectView: 'grid'
      },
      usage: {
        bundlesCreated: 0,
        storiesProcessed: 0,
        aiCreditsUsed: 0,
        lastActiveAt: now
      }
    };

    await setDoc(doc(db, 'users', uid), {
      ...userProfile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      'usage.lastActiveAt': serverTimestamp()
    });

    return userProfile;
  }

  static async getUserProfile(uid: string): Promise<UserProfile | null> {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    return {
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      usage: {
        ...data.usage,
        lastActiveAt: data.usage?.lastActiveAt?.toDate() || new Date()
      }
    } as UserProfile;
  }

  static async updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
    const docRef = doc(db, 'users', uid);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  }

  static async updateLastActive(uid: string): Promise<void> {
    const docRef = doc(db, 'users', uid);
    await updateDoc(docRef, {
      'usage.lastActiveAt': serverTimestamp()
    });
  }

  static async saveAPIKey(
    uid: string, 
    provider: 'anthropic' | 'openai' | 'perplexity' | 'googleAI', 
    apiKey: string
  ): Promise<void> {
    const docRef = doc(db, 'users', uid);
    await updateDoc(docRef, {
      [`apiKeys.${provider}`]: apiKey,
      updatedAt: serverTimestamp()
    });
  }

  static async removeAPIKey(
    uid: string, 
    provider: 'anthropic' | 'openai' | 'perplexity' | 'googleAI'
  ): Promise<void> {
    const docRef = doc(db, 'users', uid);
    await updateDoc(docRef, {
      [`apiKeys.${provider}`]: null,
      updatedAt: serverTimestamp()
    });
  }

  static async validateAPIKey(
    provider: 'anthropic' | 'openai' | 'perplexity' | 'googleAI',
    apiKey: string
  ): Promise<APIKeyStatus> {
    // This is a placeholder - you'll need to implement actual validation
    // by making a test API call to each provider
    const status: APIKeyStatus = {
      provider,
      isValid: false,
      lastChecked: new Date(),
      error: undefined
    };

    try {
      switch (provider) {
        case 'anthropic':
          // Test Anthropic API key
          // const response = await fetch...
          status.isValid = true;
          break;
        case 'openai':
          // Test OpenAI API key
          status.isValid = true;
          break;
        case 'perplexity':
          // Test Perplexity API key
          status.isValid = true;
          break;
        case 'googleAI':
          // Test Google AI API key
          status.isValid = true;
          break;
      }
    } catch (error: any) {
      status.error = error.message;
    }

    return status;
  }

  static async shareBundle(
    bundleId: string,
    ownerId: string,
    options: {
      isPublic?: boolean;
      sharedWithId?: string;
      permission?: BundlePermission;
      expiresAt?: Date;
    }
  ): Promise<BundleShare> {
    const shareData: BundleShare = {
      id: `${bundleId}_${Date.now()}`,
      bundleId,
      ownerId,
      sharedWithId: options.sharedWithId,
      isPublic: options.isPublic || false,
      permission: options.permission || 'view',
      sharedAt: new Date(),
      expiresAt: options.expiresAt,
      accessToken: options.isPublic ? this.generateAccessToken() : undefined
    };

    await setDoc(doc(db, 'bundleShares', shareData.id), {
      ...shareData,
      sharedAt: serverTimestamp(),
      expiresAt: options.expiresAt ? Timestamp.fromDate(options.expiresAt) : null
    });

    return shareData;
  }

  static async getBundleShares(bundleId: string): Promise<BundleShare[]> {
    const q = query(
      collection(db, 'bundleShares'),
      where('bundleId', '==', bundleId)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      sharedAt: doc.data().sharedAt?.toDate() || new Date(),
      expiresAt: doc.data().expiresAt?.toDate()
    } as BundleShare));
  }

  static async addTeamMember(
    teamOwnerId: string,
    userId: string,
    role: 'editor' | 'viewer',
    addedBy: string
  ): Promise<TeamMember> {
    const memberData: TeamMember = {
      id: `${teamOwnerId}_${userId}`,
      userId,
      teamOwnerId,
      role,
      addedAt: new Date(),
      addedBy
    };

    await setDoc(doc(db, 'teamMembers', memberData.id), {
      ...memberData,
      addedAt: serverTimestamp()
    });

    return memberData;
  }

  static async getTeamMembers(teamOwnerId: string): Promise<TeamMember[]> {
    const q = query(
      collection(db, 'teamMembers'),
      where('teamOwnerId', '==', teamOwnerId)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      addedAt: doc.data().addedAt?.toDate() || new Date()
    } as TeamMember));
  }

  private static generateAccessToken(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}