import { db } from '@/lib/firebase';
import { collection, doc, setDoc, updateDoc } from 'firebase/firestore';
import { BundleFile } from '@/types';
import { activityLog } from './activityLogService';
import { cleanFirestoreData } from '@/lib/utils/firebaseHelpers';
import { PDFService } from './pdfService';

export class FileUploadServiceLocal {
  static async uploadFile(
    bundleId: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<BundleFile> {
    try {
      activityLog.info(`Processing file locally: ${file.name}`);
      
      // Create unique file ID
      const fileId = `file-${bundleId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      
      // Read file as base64 for temporary storage
      const reader = new FileReader();
      const fileDataPromise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      
      const fileData = await fileDataPromise;
      
      // Create file document
      const fileDoc: BundleFile = {
        id: fileId,
        bundleId,
        name: file.name,
        type: file.type,
        size: file.size,
        uploadedAt: new Date(),
        status: 'processing',
        order: 0,
        // Store file data temporarily in Firestore (not recommended for production)
        url: fileData, // This is a data URL
      };
      
      // Save to Firestore
      await setDoc(doc(db, 'bundleFiles', fileId), cleanFirestoreData({
        ...fileDoc,
        // Don't store the actual file data in Firestore for production
        url: 'pending-upload', // Placeholder
        tempData: fileData.substring(0, 1000), // Store first 1000 chars for preview
      }));
      
      // Process file based on type
      if (file.type === 'application/pdf') {
        this.processPDFFile(fileId, file, fileData);
      }
      
      activityLog.success(`File processed: ${file.name}`);
      return fileDoc;
      
    } catch (error: any) {
      activityLog.error(`Failed to process file: ${file.name} - ${error.message}`);
      console.error('Processing error:', error);
      throw error;
    }
  }
  
  private static async processPDFFile(fileId: string, file: File, dataUrl: string) {
    try {
      activityLog.info(`Processing PDF: ${file.name}`);
      
      // Extract text from PDF using API endpoint
      let extractedText = '';
      try {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/extract-pdf-text', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to extract PDF text');
        }
        
        const result = await response.json();
        extractedText = result.text;
        
        activityLog.info(`Extracted ${result.textLength} characters from ${result.pageCount || 'unknown'} pages`);
      } catch (extractError) {
        console.error('PDF text extraction error:', extractError);
        activityLog.warning(`Failed to extract text from PDF: ${file.name}, using metadata fallback`);
        // Use the client-side fallback for metadata extraction
        extractedText = await PDFService.extractText(file);
      }
      
      // Generate thumbnail
      const thumbnailUrl = await PDFService.generateThumbnail(file);
      
      // Update file document with extracted data
      await updateDoc(doc(db, 'bundleFiles', fileId), cleanFirestoreData({
        extractedText,
        thumbnail: thumbnailUrl,
        status: 'ready',
        updatedAt: new Date(),
      }));
      
      activityLog.success(`PDF processed: ${file.name}`);
      
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
      // Delete from Firestore
      await updateDoc(doc(db, 'bundleFiles', fileId), {
        deleted: true,
        deletedAt: new Date(),
      });
      
      activityLog.info(`File deleted: ${fileId}`);
    } catch (error) {
      console.error('Delete error:', error);
      throw error;
    }
  }
}