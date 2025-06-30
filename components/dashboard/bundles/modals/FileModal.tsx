'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, DocumentIcon, SparklesIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { LinkIcon } from '@heroicons/react/24/outline';
import { BundleFile } from '@/types';
import { DocumentAnalysisService } from '@/lib/services/documentAnalysisService';
import { toast } from 'sonner';
import { activityLog } from '@/lib/services/activityLogService';
import { formatDate } from '@/lib/utils/dateHelpers';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import PDFViewer from '../PDFViewer';

interface FileModalProps {
  file: BundleFile;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedFile: BundleFile) => void;
}

const ANALYSIS_TYPES = [
  { value: 'summary', label: 'General Summary', description: 'Extract key points and create a concise summary' },
  { value: 'legal', label: 'Legal Brief Analysis', description: 'Extract case details, parties, and legal issues' },
  { value: 'opposition', label: 'Opposition Research', description: 'Identify key individuals, controversies, and strategic points' },
  { value: 'timeline', label: 'Timeline Extraction', description: 'Extract dates and create chronological timeline' },
  { value: 'entities', label: 'Entity Analysis', description: 'Identify all people, organizations, and locations' },
  { value: 'financial', label: 'Financial Analysis', description: 'Extract financial data, amounts, and transactions' },
];

export function FileModal({ file, isOpen, onClose, onUpdate }: FileModalProps) {
  const [selectedAnalysisType, setSelectedAnalysisType] = useState('summary');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'text' | 'analysis' | 'metadata'>('preview');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setActiveTab('preview');
      setSelectedAnalysisType('summary');
      setCustomPrompt('');
    }
  }, [isOpen]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Fetch fresh data from Firestore
      const fileDoc = await getDoc(doc(db, 'bundleFiles', file.id));
      if (fileDoc.exists()) {
        const freshData = {
          id: fileDoc.id,
          ...fileDoc.data(),
          uploadedAt: fileDoc.data().uploadedAt?.toDate() || new Date()
        } as BundleFile;
        onUpdate(freshData);
        toast.success('File data refreshed');
      }
    } catch (error) {
      console.error('Error refreshing file:', error);
      toast.error('Failed to refresh file data');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAnalyze = async () => {
    if (!file.extractedText) {
      toast.error('No text available for analysis');
      return;
    }

    setIsAnalyzing(true);
    activityLog.info(`Running ${selectedAnalysisType} analysis on ${file.name}`);

    try {
      await DocumentAnalysisService.analyzeDocument(
        file.id,
        file.extractedText,
        selectedAnalysisType as any,
        customPrompt || undefined
      );
      
      toast.success('Analysis complete!');
      // TODO: Refresh file data to show new analysis
      
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white dark:bg-gray-900 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full">
          {/* Header */}
          <div className="bg-gray-50 dark:bg-gray-800 px-6 py-4 flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <DocumentIcon className="w-5 h-5" />
                {file.aiTitle || file.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {(file.size / 1024 / 1024).toFixed(2)} MB • Uploaded {formatDate(file.uploadedAt, 'date')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50"
                title="Refresh file data"
              >
                <ArrowPathIcon className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-lg"
                title="Open original"
              >
                <LinkIcon className="w-5 h-5" />
              </a>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {[
                { id: 'preview', label: 'Preview' },
                { id: 'text', label: 'Extracted Text' },
                { id: 'analysis', label: 'AI Analysis' },
                { id: 'metadata', label: 'Metadata' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`
                    py-2 px-1 border-b-2 font-medium text-sm
                    ${activeTab === tab.id
                      ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }
                  `}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="px-6 py-4" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
            {/* Preview Tab */}
            {activeTab === 'preview' && (
              <div className="space-y-4">
                {file.type === 'application/pdf' && file.url ? (
                  <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        For best viewing experience, open the PDF directly. 
                        <a 
                          href={file.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="ml-2 underline hover:text-blue-800 dark:hover:text-blue-200"
                        >
                          Open in new tab →
                        </a>
                      </p>
                    </div>
                    <PDFViewer url={file.url} fileName={file.name} />
                  </div>
                ) : file.thumbnail ? (
                  <img 
                    src={file.thumbnail} 
                    alt="Document preview"
                    className="max-w-full h-auto rounded-lg"
                  />
                ) : (
                  <div className="flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg" style={{ height: '65vh' }}>
                    <DocumentIcon className="w-16 h-16 text-gray-400" />
                  </div>
                )}
                
                {file.aiSummary && (
                  <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
                    <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Summary</h4>
                    <p className="text-sm text-blue-800 dark:text-blue-200">{file.aiSummary}</p>
                  </div>
                )}
              </div>
            )}

            {/* Extracted Text Tab */}
            {activeTab === 'text' && (
              <div className="space-y-4">
                {file.extractedText ? (
                  <div>
                    <div className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                      Extracted {file.extractedText.length.toLocaleString()} characters
                    </div>
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-mono bg-gray-50 dark:bg-gray-800 p-4 rounded-lg overflow-auto" style={{ maxHeight: '65vh' }}>
                      {file.extractedText}
                    </pre>
                  </div>
                ) : file.status === 'processing' ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto mb-4"></div>
                    <p className="text-gray-500 dark:text-gray-400">
                      Extracting text from PDF...
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 italic">
                    No text extracted. The file may need to be re-uploaded.
                  </p>
                )}
              </div>
            )}

            {/* AI Analysis Tab */}
            {activeTab === 'analysis' && (
              <div className="space-y-6">
                {/* Analysis Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Analysis Type
                  </label>
                  <select
                    value={selectedAnalysisType}
                    onChange={(e) => setSelectedAnalysisType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    {ANALYSIS_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {ANALYSIS_TYPES.find(t => t.value === selectedAnalysisType)?.description}
                  </p>
                </div>

                {/* Custom Prompt */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Custom Prompt (Optional)
                  </label>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    placeholder="Add specific instructions or questions for the AI analysis..."
                  />
                </div>

                {/* Run Analysis Button */}
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !file.extractedText}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <SparklesIcon className="w-4 h-4" />
                  {isAnalyzing ? 'Analyzing...' : 'Run Analysis'}
                </button>

                {/* Previous Analyses */}
                {file.analyses && Object.keys(file.analyses).length > 0 && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900 dark:text-white">Previous Analyses</h4>
                    {Object.entries(file.analyses).map(([key, analysis]) => (
                      <div key={key} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium capitalize">{analysis.type}</span>
                          <span className="text-sm text-gray-500">
                            {formatDate(analysis.createdAt, 'datetime')}
                          </span>
                        </div>
                        <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {JSON.stringify(JSON.parse(analysis.result), null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Metadata Tab */}
            {activeTab === 'metadata' && (
              <div className="space-y-6">
                {/* Legal Metadata */}
                {file.metadata && (
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-3">Legal Information</h4>
                    <dl className="grid grid-cols-2 gap-4">
                      {Object.entries(file.metadata).map(([key, value]) => value && (
                        <div key={key}>
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                            {value instanceof Date ? formatDate(value, 'date') : String(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}

                {/* File Information */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">File Information</h4>
                  <dl className="grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">File Name</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">{file.name}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">File Type</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">{file.type}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">File Size</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Upload Date</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                        {formatDate(file.uploadedAt, 'datetime')}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default FileModal;