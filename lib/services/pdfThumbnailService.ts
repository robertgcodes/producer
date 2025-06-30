import { activityLog } from './activityLogService';

export class PDFThumbnailService {
  // Generate a PDF thumbnail using the browser's built-in PDF rendering
  static async generateThumbnail(file: File): Promise<string | null> {
    try {
      activityLog.info(`Generating thumbnail for PDF: ${file.name}`);
      
      // Create a temporary URL for the PDF file
      const fileUrl = URL.createObjectURL(file);
      
      // Create an iframe to load the PDF
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.left = '-9999px';
      iframe.style.width = '1000px';
      iframe.style.height = '1000px';
      iframe.src = fileUrl;
      
      document.body.appendChild(iframe);
      
      // Wait for the PDF to load
      await new Promise((resolve) => {
        iframe.onload = resolve;
        // Timeout after 5 seconds
        setTimeout(resolve, 5000);
      });
      
      // Create canvas to capture the thumbnail
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }
      
      // Set canvas size for thumbnail
      const thumbnailWidth = 200;
      const thumbnailHeight = 280; // A4 aspect ratio
      canvas.width = thumbnailWidth;
      canvas.height = thumbnailHeight;
      
      // For now, create a placeholder with PDF icon and filename
      // (Full PDF rendering would require pdf.js library)
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(0, 0, thumbnailWidth, thumbnailHeight);
      
      // Draw PDF icon
      ctx.fillStyle = '#dc2626';
      ctx.font = 'bold 48px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PDF', thumbnailWidth / 2, thumbnailHeight / 2 - 20);
      
      // Draw filename
      ctx.fillStyle = '#374151';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const displayName = file.name.length > 20 
        ? file.name.substring(0, 17) + '...' 
        : file.name;
      ctx.fillText(displayName, thumbnailWidth / 2, thumbnailHeight / 2 + 40);
      
      // Clean up
      document.body.removeChild(iframe);
      URL.revokeObjectURL(fileUrl);
      
      // Convert canvas to data URL
      const dataUrl = canvas.toDataURL('image/png');
      
      activityLog.success(`Generated thumbnail for PDF`);
      return dataUrl;
      
    } catch (error) {
      console.error('PDF thumbnail generation error:', error);
      activityLog.error(`Failed to generate PDF thumbnail: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }
  
  // Generate a simple placeholder thumbnail
  static generatePlaceholder(filename: string): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      return '';
    }
    
    const thumbnailWidth = 200;
    const thumbnailHeight = 280;
    canvas.width = thumbnailWidth;
    canvas.height = thumbnailHeight;
    
    // Background
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, thumbnailWidth, thumbnailHeight);
    
    // Border
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, thumbnailWidth - 2, thumbnailHeight - 2);
    
    // PDF icon (document icon)
    ctx.fillStyle = '#6b7280';
    ctx.beginPath();
    // Document shape
    ctx.moveTo(60, 80);
    ctx.lineTo(60, 200);
    ctx.lineTo(140, 200);
    ctx.lineTo(140, 100);
    ctx.lineTo(120, 100);
    ctx.lineTo(120, 80);
    ctx.closePath();
    ctx.fill();
    
    // Folded corner
    ctx.beginPath();
    ctx.moveTo(120, 80);
    ctx.lineTo(120, 100);
    ctx.lineTo(140, 100);
    ctx.closePath();
    ctx.fillStyle = '#9ca3af';
    ctx.fill();
    
    // PDF text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PDF', 100, 140);
    
    // Filename
    ctx.fillStyle = '#374151';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const displayName = filename.length > 20 
      ? filename.substring(0, 17) + '...' 
      : filename;
    ctx.fillText(displayName, thumbnailWidth / 2, thumbnailHeight - 30);
    
    return canvas.toDataURL('image/png');
  }
}