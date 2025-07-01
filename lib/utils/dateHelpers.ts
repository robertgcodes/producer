import { Timestamp } from 'firebase/firestore';

export function toDate(value: any): Date | null {
  if (!value) return null;
  
  // If it's already a Date object
  if (value instanceof Date) {
    return value;
  }
  
  // If it's a Firestore Timestamp
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  
  // If it's a Timestamp-like object with toDate method
  if (value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  
  // If it's a Timestamp-like object with seconds property
  if (value && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }
  
  // If it's a string or number, try to parse it
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
  
  return null;
}

export function formatDate(value: any, format: 'time' | 'date' | 'datetime' | 'relative' = 'datetime'): string {
  const date = toDate(value);
  
  if (!date) {
    return 'Never';
  }
  
  try {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    // Handle future dates
    if (diffMs < 0) {
      // If date is in the future, show it as "Future" or the actual date
      if (format === 'relative' || format === 'time') {
        return 'Future date';
      }
    }
    
    switch (format) {
      case 'time':
        // For recent items (less than 24 hours), show relative time
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        // For older items, show the date
        return date.toLocaleDateString();
        
      case 'date':
        return date.toLocaleDateString();
        
      case 'relative':
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minutes ago`;
        if (diffHours < 24) return `${diffHours} hours ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 30) return `${diffDays} days ago`;
        return date.toLocaleDateString();
        
      case 'datetime':
      default:
        return date.toLocaleString();
    }
  } catch (error) {
    return 'Invalid Date';
  }
}