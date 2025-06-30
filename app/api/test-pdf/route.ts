import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Test if pdf-parse can be loaded
    let pdfParseStatus = 'not loaded';
    let pdfParseError = null;
    
    try {
      const pdfParse = require('pdf-parse');
      pdfParseStatus = 'loaded successfully';
    } catch (error: any) {
      pdfParseStatus = 'failed to load';
      pdfParseError = error.message;
    }
    
    // Test environment
    const environment = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cwd: process.cwd(),
      runtime: process.env.NEXT_RUNTIME || 'unknown',
      isDev: process.env.NODE_ENV === 'development',
    };
    
    // Check if required modules are available
    const modules = {
      fs: typeof require('fs') !== 'undefined',
      path: typeof require('path') !== 'undefined',
      buffer: typeof Buffer !== 'undefined',
      stream: typeof require('stream') !== 'undefined',
    };
    
    return NextResponse.json({
      status: 'ok',
      pdfParse: {
        status: pdfParseStatus,
        error: pdfParseError,
      },
      environment,
      modules,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }, { status: 500 });
  }
}