import * as pdfLib from 'pdf-lib';
import { activityLog } from './activityLogService';

// Dynamic import for pdf-parse to avoid Node.js module issues in browser
const pdfParse = typeof window === 'undefined' 
  ? require('pdf-parse') 
  : null;

export class PDFService {
  static async extractText(file: File): Promise<string> {
    try {
      activityLog.info(`Extracting text from PDF: ${file.name}`);
      
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // If we're on the server side, use pdf-parse for full text extraction
      if (pdfParse) {
        try {
          const data = await pdfParse(buffer, {
            // Options to ensure we get all pages
            max: 0, // No limit on pages
          });
          
          activityLog.success(`Extracted text from ${data.numpages} pages (${data.text.length} characters)`);
          
          // Return the full extracted text
          return data.text.trim();
        } catch (parseError) {
          console.error('pdf-parse error, falling back to metadata:', parseError);
          // Fall through to metadata extraction
        }
      }
      
      // Fallback: Extract metadata only (for browser environment or if pdf-parse fails)
      const pdfDoc = await pdfLib.PDFDocument.load(arrayBuffer);
      
      const pageCount = pdfDoc.getPageCount();
      const metadata = {
        title: pdfDoc.getTitle(),
        author: pdfDoc.getAuthor(),
        subject: pdfDoc.getSubject(),
        creator: pdfDoc.getCreator(),
        producer: pdfDoc.getProducer(),
        creationDate: pdfDoc.getCreationDate(),
        modificationDate: pdfDoc.getModificationDate(),
        pageCount,
      };
      
      // Return metadata as fallback
      const extractedText = `
        [PDF Metadata - Full text extraction not available]
        Title: ${metadata.title || 'N/A'}
        Author: ${metadata.author || 'N/A'}
        Subject: ${metadata.subject || 'N/A'}
        Pages: ${metadata.pageCount}
        Created: ${metadata.creationDate?.toISOString() || 'N/A'}
        Modified: ${metadata.modificationDate?.toISOString() || 'N/A'}
        
        Note: To extract full text content, ensure the PDF is processed on the server side.
      `.trim();
      
      activityLog.warning(`Only metadata extracted from ${pageCount} pages (full text extraction unavailable)`);
      return extractedText;
      
    } catch (error) {
      console.error('PDF text extraction error:', error);
      throw error;
    }
  }
  
  static async generateThumbnail(file: File): Promise<string> {
    try {
      activityLog.info(`Generating thumbnail for PDF: ${file.name}`);
      
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await pdfLib.PDFDocument.load(arrayBuffer);
      
      // Get first page
      const firstPage = pdfDoc.getPage(0);
      const { width, height } = firstPage.getSize();
      
      // Create a new PDF with just the first page
      const thumbnailDoc = await pdfLib.PDFDocument.create();
      const [copiedPage] = await thumbnailDoc.copyPages(pdfDoc, [0]);
      thumbnailDoc.addPage(copiedPage);
      
      // Scale down if needed
      const maxDimension = 200;
      const scale = Math.min(maxDimension / width, maxDimension / height, 1);
      
      if (scale < 1) {
        copiedPage.scaleContent(scale, scale);
        copiedPage.setSize(width * scale, height * scale);
      }
      
      // Convert to data URL
      const thumbnailBytes = await thumbnailDoc.save();
      const blob = new Blob([thumbnailBytes], { type: 'application/pdf' });
      
      // For now, return a placeholder - in production, you'd convert to image
      // using a service like pdf2image or canvas rendering
      const dataUrl = `data:application/pdf;base64,${btoa(String.fromCharCode(...new Uint8Array(thumbnailBytes.slice(0, 1000))))}`;
      
      activityLog.success(`Generated thumbnail for PDF`);
      return dataUrl;
      
    } catch (error) {
      console.error('PDF thumbnail generation error:', error);
      // Return a default thumbnail on error
      return '/images/pdf-placeholder.png';
    }
  }
  
  static async extractMetadata(file: File): Promise<any> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await pdfLib.PDFDocument.load(arrayBuffer);
      
      return {
        title: pdfDoc.getTitle(),
        author: pdfDoc.getAuthor(),
        subject: pdfDoc.getSubject(),
        keywords: pdfDoc.getKeywords(),
        creator: pdfDoc.getCreator(),
        producer: pdfDoc.getProducer(),
        creationDate: pdfDoc.getCreationDate(),
        modificationDate: pdfDoc.getModificationDate(),
        pageCount: pdfDoc.getPageCount(),
      };
    } catch (error) {
      console.error('PDF metadata extraction error:', error);
      return null;
    }
  }
}