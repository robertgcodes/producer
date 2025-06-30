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

export function formatDate(value: any, format: 'time' | 'date' | 'datetime' = 'datetime'): string {
  const date = toDate(value);
  
  if (!date) {
    return 'Never';
  }
  
  try {
    switch (format) {
      case 'time':
        return date.toLocaleTimeString();
      case 'date':
        return date.toLocaleDateString();
      case 'datetime':
      default:
        return date.toLocaleString();
    }
  } catch (error) {
    return 'Invalid Date';
  }
}