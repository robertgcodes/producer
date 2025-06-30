/**
 * PDF Debugging utilities
 */

export function analyzePDFError(error: any): string {
  const errorMessage = error?.message || error?.toString() || 'Unknown error';
  
  // Common PDF parsing error patterns
  if (errorMessage.includes('Cannot read properties of undefined')) {
    return 'PDF structure error: The PDF may be corrupted or use an unsupported format';
  }
  
  if (errorMessage.includes('Invalid PDF structure')) {
    return 'Invalid PDF: The file appears to be corrupted or is not a valid PDF';
  }
  
  if (errorMessage.includes('Password')) {
    return 'Protected PDF: This PDF is password protected and cannot be processed';
  }
  
  if (errorMessage.includes('No text content')) {
    return 'Image-based PDF: This PDF contains only images. OCR is required to extract text';
  }
  
  if (errorMessage.includes('ENOENT') || errorMessage.includes('no such file')) {
    return 'File not found: The PDF file could not be accessed';
  }
  
  if (errorMessage.includes('heap out of memory') || errorMessage.includes('Maximum call stack')) {
    return 'PDF too large: The PDF is too large or complex to process';
  }
  
  // Default message
  return `PDF processing error: ${errorMessage}`;
}

export function getPDFExtractionTips(pageCount: number, textLength: number): string[] {
  const tips = [];
  
  if (textLength === 0 && pageCount > 0) {
    tips.push('This PDF appears to be image-based (scanned). Consider using OCR software to extract text.');
  }
  
  if (textLength < 100 && pageCount > 1) {
    tips.push('Very little text was extracted. The PDF might be primarily images or use complex formatting.');
  }
  
  if (pageCount > 100) {
    tips.push('This is a large PDF. Processing may take longer than usual.');
  }
  
  return tips;
}