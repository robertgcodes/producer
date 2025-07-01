export interface Project {
  id: string;
  name: string;
  date: Date;
  status: 'active' | 'archived' | 'template';
  analytics?: {
    views?: number;
    engagement?: number;
  };
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

export interface Bundle {
  id: string;
  projectId: string;
  userId: string;
  parentId?: string; // For nested bundles
  title: string;
  description?: string; // Additional guidance for content discovery
  theme: string;
  priority: 'hot' | 'growing' | 'cooling';
  estimatedTime: number; // in minutes
  userNotes?: string;
  legalAngle?: string;
  talkingPoints?: string[];
  selectedTitle?: string;
  selectedThumbnail?: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  lastRefreshed?: Date; // When stories were last refreshed from feeds
  // New fields for enhanced features
  notes?: string; // User notes for the bundle
  aiBrief?: string; // AI-generated brief
  storyCount?: number; // Cached story count
  researchBlocks?: ResearchBlock[];
  profileImage?: string; // Base64 or URL for bundle profile image
  selectedFeedIds?: string[]; // IDs of feeds selected for this bundle
  searchTerms?: string[]; // Additional search terms for this bundle (e.g., ["Donald Trump", "Trump", "Melania Trump"])
  icon?: string; // Icon type or emoji for the bundle
  contentItems?: ContentItem[]; // Content items in this bundle
  tags?: string[]; // Tags for categorization
  oppoResearch?: {
    subject: {
      name: string;
      position?: string;
      organization?: string;
      imageUrl?: string;
    } | null;
    summary: string[];
    sections: Array<{
      id: string;
      title: string;
      content: string;
    }>;
  };
}

export interface ContentItem {
  id: string;
  bundleId: string;
  sourceType: 'article' | 'video' | 'tweet' | 'social' | 'poll';
  url: string;
  title: string;
  description?: string;
  thumbnail?: string; // Thumbnail image URL
  publishedAt?: Date | string; // When the content was originally published
  sourceInfo: {
    name: string;
    credibility?: 'high' | 'medium' | 'low';
    bias?: 'left' | 'center' | 'right';
  };
  priority: boolean;
  userAction: 'keep' | 'archive' | 'delete' | 'unreviewed';
  notes?: string;
  addedAt: Date;
  order: number;
}

export interface Source {
  id: string;
  type: 'rss' | 'social' | 'api' | 'custom';
  name: string;
  url: string;
  credibilityScore: number; // 0-100
  tier: 1 | 2 | 3 | 4;
  active: boolean;
  rateLimit?: number;
  lastChecked?: Date;
  userId: string;
  createdAt: Date;
}

export interface AIGeneratedContent {
  id: string;
  bundleId: string;
  type: 'title' | 'thumbnail' | 'notes';
  content: string;
  selected: boolean;
  createdAt: Date;
}

// Research Block Types
export type ResearchBlockType = 
  | 'bio'
  | 'judge' 
  | 'politician' 
  | 'nonprofit' 
  | 'federal_agency' 
  | 'prosecutor'
  | 'defense_attorney'
  | 'criminal_defendant'
  | 'related_persons'
  | 'institution'
  | 'custom';

export interface ResearchBlockTemplate {
  type: ResearchBlockType;
  name: string;
  description: string;
  icon: string; // Icon identifier for UI
  defaultPrompt: string;
  fields: ResearchField[];
}

export interface ResearchField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'date';
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
}

export interface ResearchBlock {
  id: string;
  type: ResearchBlockType;
  order: number;
  subject: {
    name: string;
    [key: string]: any; // Dynamic fields based on block type
  };
  customPrompt?: string; // Override default prompt
  research: {
    status: 'pending' | 'loading' | 'completed' | 'error';
    lastUpdated?: Date;
    data?: ResearchData;
    error?: string;
  };
}

export interface ResearchData {
  summary: string[];
  sections: {
    id: string;
    title: string;
    content: string;
    sources?: {
      title: string;
      url: string;
      publishedDate?: string;
    }[];
  }[];
  metadata?: {
    searchQueries?: string[];
    totalSources?: number;
    confidence?: 'high' | 'medium' | 'low';
  };
}

// Custom Prompt Template System
export interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  prompt: string;
  category?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ResearchPromptSettings {
  templates: PromptTemplate[];
  defaultPrompts: Record<ResearchBlockType, string>; // Custom default prompts for each block type
}

export interface BundleFile {
  id: string;
  bundleId: string;
  name: string;
  type: string;
  size: number;
  url?: string;
  thumbnail?: string;
  uploadedAt: Date;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  order: number;
  
  // AI-generated content
  aiTitle?: string;
  aiSummary?: string;
  extractedText?: string;
  
  // Tags for organization
  tags?: string[];
  
  // Legal metadata
  metadata?: {
    documentType?: string;
    caseName?: string;
    caseNumber?: string;
    court?: string;
    judge?: string;
    caseType?: string;
    location?: string;
    agency?: string;
    plaintiff?: string;
    defendant?: string;
    prosecutor?: string;
    filingDate?: Date;
    parties?: string[];
  };
  
  // Custom analysis results
  analyses?: {
    [key: string]: {
      type: string;
      result: string;
      createdAt: Date;
    };
  };
}

// Re-export story cache types
export * from './storyCache';

// Re-export user types
export * from './user';