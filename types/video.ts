export interface BundleVideo {
  id: string;
  bundleId: string;
  type: 'upload' | 'youtube' | 'url';
  title: string;
  description?: string;
  url: string; // Storage URL for uploads, YouTube URL, or external URL
  sourceUrl?: string; // Original source URL for uploaded videos
  thumbnailUrl?: string;
  youtubeId?: string; // For YouTube videos
  duration?: number; // In seconds
  uploadedAt: Date;
  uploadedBy: string;
  order: number;
  metadata?: {
    width?: number;
    height?: number;
    size?: number; // File size in bytes
    mimeType?: string;
  };
}

export interface VideoUploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
}