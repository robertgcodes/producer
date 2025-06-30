import { NextRequest, NextResponse } from 'next/server';

// Force Node.js runtime for pdf-parse compatibility
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds timeout for large PDFs

// Ensure pdf-parse is loaded in Node.js context
let pdfParse: any;
try {
  pdfParse = require('pdf-parse');
} catch (error) {
  console.error('Failed to load pdf-parse:', error);
}

export async function POST(request: NextRequest) {
  console.log('PDF extraction endpoint called');
  console.log('pdf-parse module available:', !!pdfParse);
  console.log('Runtime:', process.version);
  
  try {
    // Check content type
    const contentType = request.headers.get('content-type');
    console.log('Content-Type:', contentType);

    // Check if request has a body
    if (!request.body) {
      console.error('No request body');
      return NextResponse.json(
        { error: 'No request body provided' },
        { status: 400 }
      );
    }

    let formData;
    try {
      formData = await request.formData();
    } catch (formError) {
      console.error('Error parsing form data:', formError);
      // Try to get more info about what was sent
      const text = await request.text().catch(() => 'Could not read body as text');
      console.error('Request body preview:', text.substring(0, 200));
      return NextResponse.json(
        { error: 'Failed to parse form data', details: formError instanceof Error ? formError.message : 'Unknown error' },
        { status: 400 }
      );
    }

    const file = formData.get('file') as File;
    
    if (!file) {
      console.error('No file in form data');
      return NextResponse.json(
        { error: 'No file provided in form data' },
        { status: 400 }
      );
    }

    console.log('File received:', { name: file.name, type: file.type, size: file.size });

    if (file.type !== 'application/pdf') {
      console.error('Invalid file type:', file.type);
      return NextResponse.json(
        { error: 'Invalid file. Please provide a PDF file.' },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    let buffer;
    try {
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      console.log('Buffer created, size:', buffer.length);
    } catch (bufferError) {
      console.error('Error creating buffer:', bufferError);
      return NextResponse.json(
        { error: 'Failed to process file', details: bufferError instanceof Error ? bufferError.message : 'Unknown error' },
        { status: 500 }
      );
    }

    // Try to use pdf-parse
    try {
      if (!pdfParse) {
        throw new Error('pdf-parse module not available');
      }
      
      const data = await pdfParse(buffer, {
        max: 0, // Extract all pages
      });
      
      console.log('PDF parsed successfully with pdf-parse, pages:', data.numpages);

      // Return extracted text and metadata
      const response = {
        text: data.text,
        pageCount: data.numpages,
        info: data.info,
        metadata: data.metadata,
        textLength: data.text.length,
      };

      console.log('Returning response with text length:', response.textLength);
      return NextResponse.json(response);
      
    } catch (parseError) {
      console.error('PDF parse error:', parseError);
      console.error('Error type:', parseError instanceof Error ? parseError.constructor.name : typeof parseError);
      console.error('Error message:', parseError instanceof Error ? parseError.message : String(parseError));
      console.error('Error stack:', parseError instanceof Error ? parseError.stack : 'No stack trace');
      
      // Fallback: Use pdf-lib to at least get basic info
      try {
        const { PDFDocument } = await import('pdf-lib');
        const pdfDoc = await PDFDocument.load(buffer);
        const pageCount = pdfDoc.getPageCount();
        
        console.log('Fallback: PDF loaded with pdf-lib, pages:', pageCount);
        
        // Note: pdf-lib doesn't extract text easily, so we return a limited response
        return NextResponse.json({
          text: 'Text extraction failed. PDF has ' + pageCount + ' pages. Consider using a different PDF or extraction method.',
          pageCount: pageCount,
          info: {
            Title: pdfDoc.getTitle() || 'Unknown',
            Author: pdfDoc.getAuthor() || 'Unknown',
            Subject: pdfDoc.getSubject() || 'Unknown',
            Creator: pdfDoc.getCreator() || 'Unknown',
            Producer: pdfDoc.getProducer() || 'Unknown',
            CreationDate: pdfDoc.getCreationDate()?.toISOString() || 'Unknown',
            ModificationDate: pdfDoc.getModificationDate()?.toISOString() || 'Unknown',
          },
          metadata: {},
          textLength: 0,
          error: 'Text extraction failed, only metadata available',
        });
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        return NextResponse.json(
          { error: 'Failed to parse PDF with both methods', details: fallbackError instanceof Error ? fallbackError.message : 'Unknown error' },
          { status: 500 }
        );
      }
    }

  } catch (error) {
    console.error('Unexpected PDF text extraction error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { error: 'Failed to extract text from PDF', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Add OPTIONS handler for CORS if needed
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}