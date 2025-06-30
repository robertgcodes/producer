import { storage, db, auth } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, doc, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { BundleFile } from '@/types';
import { activityLog } from './activityLogService';
import { cleanFirestoreData } from '@/lib/utils/firebaseHelpers';
import { PDFService } from './pdfService';
import { PDFThumbnailService } from './pdfThumbnailService';

export class FileUploadService {
  static async uploadFile(
    bundleId: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<BundleFile> {
    try {
      // Check if user is authenticated
      if (!auth.currentUser) {
        throw new Error('User must be authenticated to upload files');
      }

      activityLog.info(`Uploading file: ${file.name}`);
      
      // Create unique file ID
      const fileId = `file-${bundleId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      
      // Create storage reference with a cleaner path (remove spaces from filename)
      const cleanFileName = file.name.replace(/\s+/g, '_');
      const storageRef = ref(storage, `bundles/${bundleId}/files/${fileId}/${cleanFileName}`);
      
      // Upload file to Firebase Storage with metadata
      const metadata = {
        contentType: file.type,
        customMetadata: {
          originalName: file.name,
          bundleId: bundleId,
          uploadedBy: auth.currentUser.uid,
          uploadedAt: new Date().toISOString()
        }
      };
      
      const snapshot = await uploadBytes(storageRef, file, metadata);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      // Create file document
      const fileDoc: BundleFile = {
        id: fileId,
        bundleId,
        name: file.name,
        type: file.type,
        size: file.size,
        url: downloadURL,
        uploadedAt: new Date(),
        status: 'processing',
        order: 0,
      };
      
      // Save to Firestore
      await setDoc(doc(db, 'bundleFiles', fileId), cleanFirestoreData(fileDoc));
      
      // Process file based on type
      if (file.type === 'application/pdf') {
        this.processPDFFile(fileId, file, downloadURL);
      }
      
      activityLog.success(`File uploaded: ${file.name}`);
      return fileDoc;
      
    } catch (error: any) {
      activityLog.error(`Failed to upload file: ${file.name} - ${error.message}`);
      console.error('Upload error:', error);
      
      // Provide more specific error messages
      if (error.code === 'storage/unauthorized') {
        throw new Error('You do not have permission to upload files. Please ensure you are logged in.');
      } else if (error.code === 'storage/canceled') {
        throw new Error('Upload was cancelled');
      } else if (error.code === 'storage/unknown') {
        throw new Error('An unknown error occurred. Please check your internet connection and try again.');
      } else if (error.message?.includes('CORS')) {
        throw new Error('File upload configuration error. Please contact support.');
      }
      
      throw error;
    }
  }
  
  private static async processPDFFile(fileId: string, file: File, downloadURL: string) {
    try {
      activityLog.info(`Processing PDF: ${file.name}`);
      
      // Extract text from PDF using API endpoint
      let extractedText = '';
      try {
        const formData = new FormData();
        formData.append('file', file);
        
        // Try v2 endpoint first
        let response = await fetch('/api/extract-pdf-text-v2', {
          method: 'POST',
          body: formData,
        });
        
        // If v2 fails, try v1
        if (!response.ok && response.status === 404) {
          activityLog.info('Trying v1 endpoint...');
          response = await fetch('/api/extract-pdf-text', {
            method: 'POST',
            body: formData,
          });
        }
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to extract PDF text');
        }
        
        const result = await response.json();
        extractedText = result.text;
        
        if (result.warning) {
          activityLog.warning(`PDF extraction limited: ${result.warning}`);
        } else {
          activityLog.info(`Extracted ${result.textLength} characters from ${result.pageCount || 'unknown'} pages`);
        }
      } catch (extractError) {
        console.error('PDF text extraction error:', extractError);
        activityLog.warning(`Failed to extract text from PDF: ${file.name}, using metadata fallback`);
        // Use the client-side fallback for metadata extraction
        extractedText = await PDFService.extractText(file);
      }
      
      // Generate thumbnail
      const thumbnailUrl = await PDFThumbnailService.generateThumbnail(file) || 
                           PDFThumbnailService.generatePlaceholder(file.name);
      
      // Update file document with extracted data
      await updateDoc(doc(db, 'bundleFiles', fileId), cleanFirestoreData({
        extractedText,
        thumbnail: thumbnailUrl,
        status: 'ready',
        updatedAt: new Date(),
      }));
      
      activityLog.success(`PDF processed: ${file.name}`);
      
      // TODO: Trigger AI analysis
      
    } catch (error) {
      console.error('PDF processing error:', error);
      activityLog.error(`Failed to process PDF: ${file.name}`);
      
      // Update status to error
      await updateDoc(doc(db, 'bundleFiles', fileId), {
        status: 'error',
        error: error instanceof Error ? error.message : 'Processing failed',
        updatedAt: new Date(),
      });
    }
  }
  
  static async deleteFile(fileId: string): Promise<void> {
    try {
      // Get file document to get storage path
      const fileDoc = await getDoc(doc(db, 'bundleFiles', fileId));
      
      if (!fileDoc.exists()) {
        throw new Error('File not found');
      }
      
      const fileData = fileDoc.data() as BundleFile;
      
      // Delete from Firebase Storage if URL exists
      if (fileData.url) {
        try {
          // Extract the storage path from the download URL
          // The URL format is: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encodedPath}?...
          const urlParts = fileData.url.split('/o/')[1];
          if (urlParts) {
            const storagePath = decodeURIComponent(urlParts.split('?')[0]);
            const storageRef = ref(storage, storagePath);
            await deleteObject(storageRef);
            activityLog.info(`Deleted file from storage: ${storagePath}`);
          }
        } catch (storageError) {
          // Log but don't fail if storage deletion fails
          console.error('Failed to delete from storage:', storageError);
          activityLog.warning(`Failed to delete file from storage: ${fileData.name}`);
        }
      }
      
      // Delete from Firestore (hard delete)
      await deleteDoc(doc(db, 'bundleFiles', fileId));
      
      activityLog.success(`File deleted: ${fileData.name}`);
    } catch (error) {
      console.error('Delete error:', error);
      activityLog.error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
}