import { EventEmitter } from 'events';

export type ActivityType = 'info' | 'success' | 'warning' | 'error' | 'progress';

export interface ActivityMessage {
  id: string;
  type: ActivityType;
  message: string;
  timestamp: Date;
  metadata?: {
    feedId?: string;
    feedTitle?: string;
    bundleId?: string;
    bundleTitle?: string;
    progress?: {
      current: number;
      total: number;
    };
  };
}

class ActivityLogService extends EventEmitter {
  private static instance: ActivityLogService;
  private messages: ActivityMessage[] = [];
  private maxMessages = 500; // Keep last 500 messages
  
  private constructor() {
    super();
  }
  
  static getInstance(): ActivityLogService {
    if (!ActivityLogService.instance) {
      ActivityLogService.instance = new ActivityLogService();
    }
    return ActivityLogService.instance;
  }
  
  private addMessage(type: ActivityType, message: string, metadata?: ActivityMessage['metadata']) {
    const newMessage: ActivityMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      timestamp: new Date(),
      metadata
    };
    
    this.messages.push(newMessage);
    
    // Keep only the last maxMessages
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }
    
    // Emit the new message
    this.emit('message', newMessage);
    
    // Also log to console for debugging
    const prefix = type === 'error' ? '❌' : 
                   type === 'warning' ? '⚠️' : 
                   type === 'success' ? '✅' : 
                   type === 'progress' ? '🔄' : 'ℹ️';
    console.log(`${prefix} [ActivityLog] ${message}`, metadata || '');
  }
  
  info(message: string, metadata?: ActivityMessage['metadata']) {
    this.addMessage('info', message, metadata);
  }
  
  success(message: string, metadata?: ActivityMessage['metadata']) {
    this.addMessage('success', message, metadata);
  }
  
  warning(message: string, metadata?: ActivityMessage['metadata']) {
    this.addMessage('warning', message, metadata);
  }
  
  error(message: string, metadata?: ActivityMessage['metadata']) {
    this.addMessage('error', message, metadata);
  }
  
  progress(message: string, current: number, total: number, metadata?: Omit<ActivityMessage['metadata'], 'progress'>) {
    this.addMessage('progress', message, {
      ...metadata,
      progress: { current, total }
    });
  }
  
  getMessages(): ActivityMessage[] {
    return [...this.messages];
  }
  
  clear() {
    this.messages = [];
    this.emit('clear');
  }
  
  // Convenience methods for common operations
  startFeedRefresh(feedTitle: string, feedId: string) {
    this.info(`Refreshing feed: ${feedTitle}`, { feedId, feedTitle });
  }
  
  completeFeedRefresh(feedTitle: string, feedId: string, itemCount: number) {
    this.success(`Refreshed ${feedTitle}: ${itemCount} items`, { feedId, feedTitle });
  }
  
  errorFeedRefresh(feedTitle: string, feedId: string, error: string) {
    this.error(`Failed to refresh ${feedTitle}: ${error}`, { feedId, feedTitle });
  }
  
  startBundleSearch(bundleTitle: string, bundleId: string) {
    this.info(`Searching stories for bundle: ${bundleTitle}`, { bundleId, bundleTitle });
  }
  
  completeBundleSearch(bundleTitle: string, bundleId: string, storyCount: number) {
    this.success(`Found ${storyCount} stories for ${bundleTitle}`, { bundleId, bundleTitle });
  }
  
  addStoryToBundle(storyTitle: string, bundleTitle: string) {
    this.success(`Added story to ${bundleTitle}: ${storyTitle.substring(0, 80)}...`);
  }
  
  removeStoryFromBundle(storyTitle: string, bundleTitle: string) {
    this.info(`Removed story from ${bundleTitle}: ${storyTitle.substring(0, 80)}...`);
  }
}

export const activityLog = ActivityLogService.getInstance();