'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { UserProfile, FeatureAccess } from '@/types/user';
import { UserService } from '@/lib/userService';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  featureAccess: FeatureAccess;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<void>;
  saveAPIKey: (provider: 'anthropic' | 'openai' | 'perplexity' | 'googleAI', apiKey: string) => Promise<void>;
  removeAPIKey: (provider: 'anthropic' | 'openai' | 'perplexity' | 'googleAI') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const getFeatureAccess = (profile: UserProfile | null): FeatureAccess => {
    if (!profile) {
      return {
        aiSummaries: false,
        aiTitleGeneration: false,
        aiThumbnailGeneration: false,
        aiResearch: false,
        aiClustering: false,
        availableProviders: []
      };
    }

    // Admin gets all features
    if (profile.role === 'admin') {
      return {
        aiSummaries: true,
        aiTitleGeneration: true,
        aiThumbnailGeneration: true,
        aiResearch: true,
        aiClustering: true,
        availableProviders: ['anthropic', 'openai', 'perplexity', 'googleAI']
      };
    }

    // Regular users need API keys
    const providers: string[] = [];
    const hasAnthropic = !!profile.apiKeys?.anthropic;
    const hasOpenAI = !!profile.apiKeys?.openai;
    const hasPerplexity = !!profile.apiKeys?.perplexity;
    const hasGoogleAI = !!profile.apiKeys?.googleAI;

    if (hasAnthropic) providers.push('anthropic');
    if (hasOpenAI) providers.push('openai');
    if (hasPerplexity) providers.push('perplexity');
    if (hasGoogleAI) providers.push('googleAI');

    const hasAnyAI = providers.length > 0;

    return {
      aiSummaries: hasAnyAI,
      aiTitleGeneration: hasAnyAI,
      aiThumbnailGeneration: hasOpenAI || hasGoogleAI,
      aiResearch: hasPerplexity || hasAnthropic,
      aiClustering: hasAnyAI,
      availableProviders: providers
    };
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Load or create user profile
        let profile = await UserService.getUserProfile(firebaseUser.uid);
        
        if (!profile) {
          // Create profile for new user
          profile = await UserService.createUserProfile(
            firebaseUser.uid,
            firebaseUser.email!,
            firebaseUser.displayName || undefined
          );
        }
        
        setUserProfile(profile);
        // Update last active
        UserService.updateLastActive(firebaseUser.uid);
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    // Profile will be created in the onAuthStateChanged listener
  };

  const logout = async () => {
    await signOut(auth);
    setUserProfile(null);
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    // Profile will be created/loaded in the onAuthStateChanged listener
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const updateUserProfile = async (updates: Partial<UserProfile>) => {
    if (!user || !userProfile) return;
    
    await UserService.updateUserProfile(user.uid, updates);
    
    // Update local state
    setUserProfile({
      ...userProfile,
      ...updates,
      updatedAt: new Date()
    });
  };

  const saveAPIKey = async (provider: 'anthropic' | 'openai' | 'perplexity' | 'googleAI', apiKey: string) => {
    if (!user || !userProfile) return;
    
    await UserService.saveAPIKey(user.uid, provider, apiKey);
    
    // Update local state
    setUserProfile({
      ...userProfile,
      apiKeys: {
        ...userProfile.apiKeys,
        [provider]: apiKey
      },
      updatedAt: new Date()
    });
  };

  const removeAPIKey = async (provider: 'anthropic' | 'openai' | 'perplexity' | 'googleAI') => {
    if (!user || !userProfile) return;
    
    await UserService.removeAPIKey(user.uid, provider);
    
    // Update local state
    const updatedApiKeys = { ...userProfile.apiKeys };
    delete updatedApiKeys[provider];
    
    setUserProfile({
      ...userProfile,
      apiKeys: updatedApiKeys,
      updatedAt: new Date()
    });
  };

  const value = {
    user,
    userProfile,
    loading,
    featureAccess: getFeatureAccess(userProfile),
    signIn,
    signUp,
    logout,
    signInWithGoogle,
    resetPassword,
    updateUserProfile,
    saveAPIKey,
    removeAPIKey
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}