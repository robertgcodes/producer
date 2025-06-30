import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  getDocs,
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject,
  uploadString,
  UploadTask 
} from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { BundleVideo, VideoUploadProgress } from '@/types/video';
import { cleanFirestoreData } from '@/lib/utils/firebaseHelpers';

export class BundleVideosService {
  private static readonly COLLECTION_NAME = 'bundleVideos';
  private static readonly STORAGE_PATH = 'bundle-videos';
  private static readonly THUMBNAILS_PATH = 'bundle-video-thumbnails';

  /**
   * Upload a video file to Firebase Storage
   */
  static uploadVideo(
    file: File,
    bundleId: string,
    userId: string,
    onProgress?: (progress: VideoUploadProgress) => void
  ): UploadTask {
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${bundleId}/${timestamp}_${safeName}`;
    const storageRef = ref(storage, `${this.STORAGE_PATH}/${fileName}`);
    
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
    });

    if (onProgress) {
      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress: VideoUploadProgress = {
            bytesTransferred: snapshot.bytesTransferred,
            totalBytes: snapshot.totalBytes,
            percentage: (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          };
          onProgress(progress);
        }
      );
    }

    return uploadTask;
  }

  /**
   * Upload a thumbnail image to Firebase Storage
   */
  static async uploadThumbnail(
    dataUrl: string,
    bundleId: string,
    videoId: string
  ): Promise<string> {
    const fileName = `${bundleId}/${videoId}_thumbnail.jpg`;
    const storageRef = ref(storage, `${this.THUMBNAILS_PATH}/${fileName}`);
    
    // Upload the data URL
    await uploadString(storageRef, dataUrl, 'data_url');
    
    // Get the download URL
    return await getDownloadURL(storageRef);
  }

  /**
   * Save video metadata to Firestore
   */
  static async saveVideo(video: Omit<BundleVideo, 'id'>): Promise<string> {
    const videoId = `${video.bundleId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const videoRef = doc(db, this.COLLECTION_NAME, videoId);
    
    const videoData: BundleVideo = {
      ...video,
      id: videoId,
      uploadedAt: new Date(),
    };
    
    await setDoc(videoRef, cleanFirestoreData(videoData));
    return videoId;
  }

  /**
   * Add a YouTube video to a bundle
   */
  static async addYouTubeVideo(
    bundleId: string,
    youtubeUrl: string,
    title: string,
    description: string,
    userId: string
  ): Promise<string> {
    // Extract YouTube ID from URL
    const youtubeId = this.extractYouTubeId(youtubeUrl);
    if (!youtubeId) {
      throw new Error('Invalid YouTube URL');
    }

    // Get the highest order value
    const videos = await this.getBundleVideos(bundleId);
    const maxOrder = videos.length > 0 
      ? Math.max(...videos.map(v => v.order || 0)) 
      : -1;

    const video: Omit<BundleVideo, 'id'> = {
      bundleId,
      type: 'youtube',
      title,
      description,
      url: youtubeUrl,
      youtubeId,
      thumbnailUrl: `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`,
      uploadedAt: new Date(),
      uploadedBy: userId,
      order: maxOrder + 1,
    };

    return await this.saveVideo(video);
  }

  /**
   * Add an external video URL to a bundle
   */
  static async addExternalVideo(
    bundleId: string,
    videoUrl: string,
    title: string,
    description: string,
    thumbnailUrl: string | undefined,
    userId: string
  ): Promise<string> {
    // Get the highest order value
    const videos = await this.getBundleVideos(bundleId);
    const maxOrder = videos.length > 0 
      ? Math.max(...videos.map(v => v.order || 0)) 
      : -1;

    const video: Omit<BundleVideo, 'id'> = {
      bundleId,
      type: 'url',
      title,
      description,
      url: videoUrl,
      thumbnailUrl,
      uploadedAt: new Date(),
      uploadedBy: userId,
      order: maxOrder + 1,
    };

    return await this.saveVideo(video);
  }

  /**
   * Extract YouTube video ID from various URL formats
   */
  static extractYouTubeId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\?\/]+)/,
      /youtube\.com\/v\/([^&\?\/]+)/,
      /youtube\.com\/shorts\/([^&\?\/]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    // Check if it's just the ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
      return url;
    }

    return null;
  }

  /**
   * Get all videos for a bundle
   */
  static async getBundleVideos(bundleId: string): Promise<BundleVideo[]> {
    const q = query(
      collection(db, this.COLLECTION_NAME),
      where('bundleId', '==', bundleId),
      orderBy('order', 'asc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
      uploadedAt: doc.data().uploadedAt?.toDate() || new Date(),
    } as BundleVideo));
  }

  /**
   * Update video metadata
   */
  static async updateVideo(
    videoId: string, 
    updates: Partial<BundleVideo>
  ): Promise<void> {
    const videoRef = doc(db, this.COLLECTION_NAME, videoId);
    await updateDoc(videoRef, cleanFirestoreData(updates));
  }

  /**
   * Update video order
   */
  static async updateVideoOrder(videos: Array<{id: string, order: number}>): Promise<void> {
    const batch = writeBatch(db);
    
    videos.forEach(({ id, order }) => {
      const videoRef = doc(db, this.COLLECTION_NAME, id);
      batch.update(videoRef, { order });
    });
    
    await batch.commit();
  }

  /**
   * Delete a video
   */
  static async deleteVideo(video: BundleVideo): Promise<void> {
    // Delete from Firestore
    await deleteDoc(doc(db, this.COLLECTION_NAME, video.id));
    
    // Delete from Storage if it's an uploaded video
    if (video.type === 'upload' && video.url) {
      try {
        const storageRef = ref(storage, video.url);
        await deleteObject(storageRef);
      } catch (error) {
        console.error('Error deleting video from storage:', error);
        // Continue even if storage deletion fails
      }
    }
  }

  /**
   * Generate a thumbnail URL for a video
   */
  static generateVideoThumbnail(video: BundleVideo): string {
    if (video.thumbnailUrl) {
      return video.thumbnailUrl;
    }

    if (video.type === 'youtube' && video.youtubeId) {
      return `https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`;
    }

    // Default thumbnail for other video types
    return '/video-placeholder.svg';
  }
}