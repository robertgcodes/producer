'use client';

import { useState, useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  DocumentIcon, 
  TrashIcon, 
  ArrowUpIcon, 
  ArrowDownIcon, 
  SparklesIcon, 
  MagnifyingGlassIcon, 
  FunnelIcon, 
  TagIcon, 
  CalendarIcon, 
  ArrowsUpDownIcon 
} from '@heroicons/react/24/outline';
import { LinkIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { BundleFile } from '@/types';
import { activityLog } from '@/lib/services/activityLogService';
import { FileUploadService } from '@/lib/services/fileUploadService';
import { DocumentAnalysisService } from '@/lib/services/documentAnalysisService';
import { FileModal } from '../modals/FileModal';
import { formatDate } from '@/lib/utils/dateHelpers';

interface FilesTabProps {
  bundleId: string;
  files: BundleFile[];
  onFilesUpdate: (files: BundleFile[]) => void;
}

export function FilesTab({ bundleId, files, onFilesUpdate }: FilesTabProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<BundleFile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsUploading(true);
    
    try {
      const uploadedFiles: BundleFile[] = [];
      
      for (const file of acceptedFiles) {
        try {
          const uploadedFile = await FileUploadService.uploadFile(bundleId, file);
          uploadedFile.order = files.length + uploadedFiles.length;
          uploadedFiles.push(uploadedFile);
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);
          toast.error(`Failed to upload ${file.name}`);
        }
      }
      
      if (uploadedFiles.length > 0) {
        onFilesUpdate([...files, ...uploadedFiles]);
        toast.success(`${uploadedFiles.length} file(s) uploaded successfully`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload files');
    } finally {
      setIsUploading(false);
    }
  }, [bundleId, files, onFilesUpdate]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    },
    multiple: true,
  });

  const handleDeleteFile = async (fileId: string) => {
    try {
      await FileUploadService.deleteFile(fileId);
      onFilesUpdate(files.filter(f => f.id !== fileId));
      toast.success('File deleted');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete file');
    }
  };

  const handleReorderFile = (fileId: string, direction: 'up' | 'down') => {
    const fileIndex = files.findIndex(f => f.id === fileId);
    if (fileIndex === -1) return;

    const newFiles = [...files];
    const targetIndex = direction === 'up' ? fileIndex - 1 : fileIndex + 1;

    if (targetIndex < 0 || targetIndex >= files.length) return;

    // Swap the files
    [newFiles[fileIndex], newFiles[targetIndex]] = [newFiles[targetIndex], newFiles[fileIndex]];
    
    // Update order values
    newFiles.forEach((file, index) => {
      file.order = index;
    });

    onFilesUpdate(newFiles);
  };

  const handleFileClick = (file: BundleFile) => {
    setSelectedFile(file);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedFile(null);
  };

  const handleFileUpdate = (updatedFile: BundleFile) => {
    const updatedFiles = files.map(f => 
      f.id === updatedFile.id ? updatedFile : f
    );
    onFilesUpdate(updatedFiles);
  };

  // Filter and sort files
  const filteredAndSortedFiles = useMemo(() => {
    let filtered = files;
    
    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(file => 
        file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.aiTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.aiSummary?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Apply tag filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter(file => 
        file.tags?.some(tag => selectedTags.includes(tag)) || false
      );
    }
    
    // Sort files
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
          break;
        case 'name':
          comparison = (a.aiTitle || a.name).localeCompare(b.aiTitle || b.name);
          break;
        case 'size':
          comparison = b.size - a.size;
          break;
      }
      
      return sortOrder === 'desc' ? comparison : -comparison;
    });
  }, [files, searchQuery, selectedTags, sortBy, sortOrder]);

  // Extract all unique tags from files
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    files.forEach(file => {
      file.tags?.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [files]);

  return (
    <div className="p-6 space-y-6">
      {/* Header Controls */}
      <div className="space-y-4">
        {/* Search and Sort Controls */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
          
          {/* Sort Controls */}
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="date">Sort by Date</option>
              <option value="name">Sort by Name</option>
              <option value="size">Sort by Size</option>
            </select>
            
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
              title={sortOrder === 'asc' ? 'Sort Descending' : 'Sort Ascending'}
            >
              <ArrowsUpDownIcon className={`w-5 h-5 transform ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
        
        {/* Tags Filter */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <TagIcon className="w-4 h-4" /> Filter by tags:
            </span>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedTags(
                  selectedTags.includes(tag) 
                    ? selectedTags.filter(t => t !== tag)
                    : [...selectedTags, tag]
                )}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  selectedTags.includes(tag)
                    ? 'bg-brand-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
        
        {/* Upload Area - Smaller */}
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
            ${isDragActive 
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' 
              : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
            }
            ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input {...getInputProps()} disabled={isUploading} />
          <div className="flex items-center justify-center gap-3">
            <DocumentIcon className="w-8 h-8 text-gray-400" />
            <div className="text-left">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {isDragActive ? 'Drop files here' : 'Drop files or click to upload'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                PDF, Word, and PowerPoint files
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Files List */}
      {filteredAndSortedFiles.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {filteredAndSortedFiles.length} {filteredAndSortedFiles.length === 1 ? 'file' : 'files'}
              {searchQuery && ` matching "${searchQuery}"`}
            </h3>
          </div>
          {filteredAndSortedFiles.map((file, index) => (
            <div
              key={file.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-all cursor-pointer"
              onClick={() => handleFileClick(file)}
            >
              <div className="flex items-start gap-4">
                {/* Thumbnail Placeholder */}
                <div className="w-20 h-28 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center flex-shrink-0">
                  {file.thumbnail ? (
                    <img 
                      src={file.thumbnail} 
                      alt={`${file.name} thumbnail`}
                      className="w-full h-full object-cover rounded"
                    />
                  ) : (
                    <DocumentIcon className="w-8 h-8 text-gray-400" />
                  )}
                </div>

                {/* File Info */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
                        >
                          {file.aiTitle || file.name}
                          <LinkIcon className="w-3.5 h-3.5" />
                        </a>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {(file.size / 1024 / 1024).toFixed(2)} MB • {formatDate(file.uploadedAt, 'date')}
                        {file.status === 'processing' && ' • Processing...'}
                        {file.status === 'error' && ' • Error'}
                      </p>
                      {file.metadata?.documentType && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {file.metadata.documentType}
                          {file.metadata.caseName && ` • ${file.metadata.caseName}`}
                          {file.metadata.court && ` • ${file.metadata.court}`}
                        </p>
                      )}
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {sortBy === 'date' && sortOrder === 'desc' && (
                        <>
                          {index > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReorderFile(file.id, 'up');
                              }}
                              className="p-1.5 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                              title="Move up"
                            >
                              <ArrowUpIcon className="w-4 h-4" />
                            </button>
                          )}
                          
                          {index < filteredAndSortedFiles.length - 1 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReorderFile(file.id, 'down');
                              }}
                              className="p-1.5 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                              title="Move down"
                            >
                              <ArrowDownIcon className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                      
                      {/* Download Button */}
                      <a
                        href={file.url}
                        download={file.name}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded"
                        title="Download file"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </a>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFile(file.id);
                        }}
                        className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded"
                        title="Delete"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* AI Summary */}
                  {file.aiSummary && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                      {file.aiSummary}
                    </p>
                  )}

                  {/* Metadata */}
                  {file.metadata && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      {file.metadata.caseName && (
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                          {file.metadata.caseName}
                        </span>
                      )}
                      {file.metadata.caseNumber && (
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                          #{file.metadata.caseNumber}
                        </span>
                      )}
                      {file.metadata.court && (
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                          {file.metadata.court}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {files.length > 0 ? (
            <div className="text-center py-12">
              <MagnifyingGlassIcon className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-700 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                No files match your search criteria
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedTags([]);
                }}
                className="mt-2 text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="text-center py-12">
              <DocumentIcon className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-700 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                No files uploaded yet. Drop some documents to get started!
              </p>
            </div>
          )}
        </>
      )}

      {/* File Modal */}
      {selectedFile && isModalOpen && (
        <FileModal
          file={selectedFile}
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onUpdate={handleFileUpdate}
        />
      )}
    </div>
  );
}