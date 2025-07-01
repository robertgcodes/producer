export type UserRole = 'admin' | 'user';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  
  // API Keys for AI services
  apiKeys?: {
    anthropic?: string;
    openai?: string;
    perplexity?: string;
    googleAI?: string;
  };
  
  // User settings
  settings?: {
    theme?: 'light' | 'dark' | 'system';
    autoRefreshFeeds?: boolean;
    refreshInterval?: number; // in minutes
    emailNotifications?: boolean;
    defaultProjectView?: 'grid' | 'list';
  };
  
  // Usage stats
  usage?: {
    bundlesCreated?: number;
    storiesProcessed?: number;
    aiCreditsUsed?: number;
    lastActiveAt?: Date;
  };
}

// Bundle sharing permissions
export type BundlePermission = 'view' | 'edit' | 'admin';

export interface BundleShare {
  id: string;
  bundleId: string;
  ownerId: string; // The user who owns the bundle
  sharedWithId?: string; // User ID if shared with specific user
  isPublic: boolean; // If true, bundle is publicly accessible
  permission: BundlePermission;
  sharedAt: Date;
  expiresAt?: Date; // Optional expiration date
  accessToken?: string; // For public share links
}

// Team collaboration
export interface TeamMember {
  id: string;
  userId: string;
  teamOwnerId: string; // The admin user who owns the team
  role: 'editor' | 'viewer';
  addedAt: Date;
  addedBy: string;
}

// API Key validation status
export interface APIKeyStatus {
  provider: 'anthropic' | 'openai' | 'perplexity' | 'googleAI';
  isValid: boolean;
  lastChecked: Date;
  error?: string;
}

// Feature access based on API keys
export interface FeatureAccess {
  aiSummaries: boolean;
  aiTitleGeneration: boolean;
  aiThumbnailGeneration: boolean;
  aiResearch: boolean;
  aiClustering: boolean;
  availableProviders: string[];
}