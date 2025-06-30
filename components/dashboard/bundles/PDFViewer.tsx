'use client';

import { useState, useEffect } from 'react';
import { DocumentIcon } from '@heroicons/react/24/outline';

interface PDFViewerProps {
  url: string;
  fileName: string;
}

export default function PDFViewer({ url, fileName }: PDFViewerProps) {
  const [viewerError, setViewerError] = useState(false);
  const [useGoogleViewer, setUseGoogleViewer] = useState(false);

  // Check if URL is from Firebase Storage
  const isFirebaseUrl = url.includes('firebasestorage.googleapis.com');
  
  // For Firebase URLs, we can try direct embedding first
  const pdfSrc = useGoogleViewer && isFirebaseUrl 
    ? `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`
    : url;

  useEffect(() => {
    // Reset error state when URL changes
    setViewerError(false);
    setUseGoogleViewer(false);
  }, [url]);

  const handleIframeError = () => {
    if (!useGoogleViewer && isFirebaseUrl) {
      // Try Google Docs viewer as fallback
      setUseGoogleViewer(true);
    } else {
      setViewerError(true);
    }
  };

  return (
    <div className="relative">
      {!viewerError ? (
        <>
          <iframe
            src={pdfSrc}
            className="w-full"
            style={{ border: 'none', height: '65vh' }}
            title={`PDF Preview: ${fileName}`}
            loading="lazy"
            onError={handleIframeError}
            // Minimal permissions to avoid console warnings
            sandbox="allow-same-origin allow-scripts"
          />
          {useGoogleViewer && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
              Using Google Docs viewer for better compatibility
            </p>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg" style={{ height: '65vh' }}>
          <DocumentIcon className="w-16 h-16 mb-4 text-gray-400" />
          <p className="text-center mb-4 text-gray-500 dark:text-gray-400">
            Unable to display PDF in browser
          </p>
          <p className="text-xs text-center mb-4 text-gray-400 dark:text-gray-500 max-w-md">
            This might be due to browser security settings or the PDF format.
          </p>
          <div className="flex gap-3">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
            >
              Open in New Tab
            </a>
            <a
              href={url}
              download={fileName}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Download PDF
            </a>
          </div>
        </div>
      )}
      
      {/* Hidden fallback that's always rendered but only visible if iframe fails to load */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 -z-10">
        <DocumentIcon className="w-16 h-16 mb-4 text-gray-400" />
        <p className="text-center mb-4 text-gray-500 dark:text-gray-400">
          Loading PDF...
        </p>
      </div>
    </div>
  );
}