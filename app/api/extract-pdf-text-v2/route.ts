import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { analyzePDFError, getPDFExtractionTips } from '@/lib/utils/pdfDebug';

// Use Node.js runtime
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  console.log('PDF extraction v2 endpoint called');
  
  try {
    // Parse the request
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Invalid file type. Please provide a PDF file.' },
        { status: 400 }
      );
    }

    // Convert to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // First, try the traditional pdf-parse approach
    try {
      const pdfParse = await import('pdf-parse').then(m => m.default || m);
      
      const data = await pdfParse(buffer, {
        max: 0, // Extract all pages
        // Add custom page render function to handle special cases
        pagerender: (pageData: any) => {
          // Default page rendering
          let render_options = {
            normalizeWhitespace: false,
            disableCombineTextItems: false
          };

          return pageData.getTextContent(render_options)
            .then((textContent: any) => {
              let lastY, text = '';
              for (let item of textContent.items) {
                if (lastY == item.transform[5] || !lastY) {
                  text += item.str;
                } else {
                  text += '\n' + item.str;
                }
                lastY = item.transform[5];
              }
              return text;
            });
        }
      });
      
      console.log('PDF parsed successfully, pages:', data.numpages);
      
      return NextResponse.json({
        text: data.text,
        pageCount: data.numpages,
        info: data.info,
        metadata: data.metadata,
        textLength: data.text.length,
      });
      
    } catch (parseError: any) {
      console.error('pdf-parse failed:', parseError.message);
      const friendlyError = analyzePDFError(parseError);
      
      // Fallback: Use pdf-lib for basic info and return structured error
      const pdfDoc = await PDFDocument.load(buffer);
      const pageCount = pdfDoc.getPageCount();
      
      // Try to extract some text using pdf-lib (limited capability)
      let extractedText = '';
      const metadata = {
        title: pdfDoc.getTitle(),
        author: pdfDoc.getAuthor(),
        subject: pdfDoc.getSubject(),
        creator: pdfDoc.getCreator(),
        pageCount: pageCount,
      };
      
      // For now, return metadata with a note about text extraction
      extractedText = `[PDF Metadata Extracted]
Title: ${metadata.title || 'Unknown'}
Author: ${metadata.author || 'Unknown'}
Subject: ${metadata.subject || 'Unknown'}
Pages: ${metadata.pageCount}

Note: ${friendlyError}

Possible solutions:
- For scanned PDFs, use OCR software to extract text
- For protected PDFs, remove password protection first
- For corrupted PDFs, try repairing with PDF tools`;
      
      const tips = getPDFExtractionTips(pageCount, 0);
      
      return NextResponse.json({
        text: extractedText,
        pageCount: pageCount,
        info: {
          Title: metadata.title,
          Author: metadata.author,
          Subject: metadata.subject,
          Creator: metadata.creator,
        },
        metadata: {},
        textLength: extractedText.length,
        warning: 'Limited extraction - only metadata available',
        tips: tips,
        errorDetails: friendlyError,
      });
    }
    
  } catch (error: any) {
    console.error('PDF extraction error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to extract PDF text',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}