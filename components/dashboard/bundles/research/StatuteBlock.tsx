'use client';

import { useState, useRef } from 'react';
import { ResearchBlock, StatuteData } from '@/types';
import { FiUpload, FiExternalLink, FiImage, FiFileText, FiRefreshCw, FiTrash2 } from 'react-icons/fi';
import { AIService } from '@/lib/services/aiService';
import { useAuth } from '@/contexts/AuthContext';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface StatuteBlockProps {
  block: ResearchBlock;
  promptTemplates: Array<{ id: string; title: string; prompt: string }>;
  onUpdate: (blockId: string, data: Partial<ResearchBlock>) => void;
  onDelete: (blockId: string) => void;
}

export function StatuteBlock({ block, promptTemplates, onUpdate, onDelete }: StatuteBlockProps) {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(!block.subject?.name);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPromptId, setSelectedPromptId] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const statuteData = block.subject as StatuteData;

  const handleSave = () => {
    if (!statuteData.title?.trim()) {
      alert('Please enter a statute title');
      return;
    }
    setIsEditing(false);
  };

  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file');
      return;
    }

    setUploadingPdf(true);
    try {
      // Upload to Firebase Storage
      const fileName = `statutes/${user.uid}/${Date.now()}-${file.name}`;
      const storageRef = ref(storage, fileName);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      onUpdate(block.id, {
        subject: {
          ...statuteData,
          pdfUrl: downloadURL
        }
      });
    } catch (error) {
      console.error('Error uploading PDF:', error);
      alert('Failed to upload PDF');
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleThumbnailUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    setUploadingThumbnail(true);
    try {
      // Upload to Firebase Storage
      const fileName = `statutes/${user.uid}/thumbnails/${Date.now()}-${file.name}`;
      const storageRef = ref(storage, fileName);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      onUpdate(block.id, {
        subject: {
          ...statuteData,
          thumbnailUrl: downloadURL
        }
      });
    } catch (error) {
      console.error('Error uploading thumbnail:', error);
      alert('Failed to upload thumbnail');
    } finally {
      setUploadingThumbnail(false);
    }
  };

  const generateAISummary = async () => {
    if (!statuteData.title || !statuteData.description) {
      alert('Please add a title and description first');
      return;
    }

    setIsGenerating(true);
    try {
      const context = `Statute Title: ${statuteData.title}\nDescription: ${statuteData.description}`;
      const prompt = customPrompt || 'Please provide a comprehensive legal summary of this statute, including its key provisions, scope, and practical implications.';
      
      const result = await AIService.generateStatuteAnalysis(context, prompt);
      
      onUpdate(block.id, {
        subject: {
          ...statuteData,
          aiSummary: result
        }
      });
    } catch (error) {
      console.error('Error generating AI summary:', error);
      alert('Failed to generate AI summary');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateCustomAnalysis = async () => {
    if (!selectedPromptId) {
      alert('Please select a prompt template');
      return;
    }

    const template = promptTemplates.find(t => t.id === selectedPromptId);
    if (!template) return;

    setIsGenerating(true);
    try {
      const context = `Statute Title: ${statuteData.title}\nDescription: ${statuteData.description}${statuteData.aiSummary ? `\nSummary: ${statuteData.aiSummary}` : ''}`;
      const result = await AIService.generateStatuteAnalysis(context, template.prompt);
      
      const customAnalyses = statuteData.customAnalyses || {};
      customAnalyses[template.id] = {
        prompt: template.title,
        result,
        timestamp: new Date()
      };

      onUpdate(block.id, {
        subject: {
          ...statuteData,
          customAnalyses
        }
      });
    } catch (error) {
      console.error('Error generating custom analysis:', error);
      alert('Failed to generate custom analysis');
    } finally {
      setIsGenerating(false);
      setSelectedPromptId('');
    }
  };

  if (isEditing) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FiFileText className="w-5 h-5 text-brand-600" />
            Statute Block
          </h3>
          <button
            onClick={() => onDelete(block.id)}
            className="text-red-500 hover:text-red-600"
          >
            <FiTrash2 className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Statute Title
            </label>
            <input
              type="text"
              value={statuteData.title || ''}
              onChange={(e) => onUpdate(block.id, {
                subject: { ...statuteData, title: e.target.value }
              })}
              placeholder="e.g., 18 U.S.C. § 1001"
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={statuteData.description || ''}
              onChange={(e) => onUpdate(block.id, {
                subject: { ...statuteData, description: e.target.value }
              })}
              placeholder="Brief description of the statute..."
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Statute URL
            </label>
            <input
              type="url"
              value={statuteData.statuteUrl || ''}
              onChange={(e) => onUpdate(block.id, {
                subject: { ...statuteData, statuteUrl: e.target.value }
              })}
              placeholder="https://www.law.cornell.edu/..."
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleSave}
              disabled={!statuteData.title?.trim()}
              className="btn-primary"
            >
              Save Statute
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FiFileText className="w-5 h-5 text-brand-600" />
            {statuteData.title || 'Untitled Statute'}
          </h3>
          {statuteData.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {statuteData.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditing(true)}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(block.id)}
            className="text-red-500 hover:text-red-600"
          >
            <FiTrash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {statuteData.statuteUrl && (
        <a
          href={statuteData.statuteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 text-sm mb-4"
        >
          <FiExternalLink className="w-4 h-4" />
          View Full Statute
        </a>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* PDF Upload */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            PDF Document
          </h4>
          {statuteData.pdfUrl ? (
            <div className="flex items-center justify-between">
              <a
                href={statuteData.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 text-sm flex items-center gap-2"
              >
                <FiFileText className="w-4 h-4" />
                View PDF
              </a>
              <button
                onClick={() => pdfInputRef.current?.click()}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm"
              >
                Replace
              </button>
            </div>
          ) : (
            <button
              onClick={() => pdfInputRef.current?.click()}
              disabled={uploadingPdf}
              className="w-full py-2 px-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-center gap-2"
            >
              {uploadingPdf ? (
                <>
                  <FiRefreshCw className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <FiUpload className="w-4 h-4" />
                  Upload PDF
                </>
              )}
            </button>
          )}
          <input
            ref={pdfInputRef}
            type="file"
            accept="application/pdf"
            onChange={handlePdfUpload}
            className="hidden"
          />
        </div>

        {/* Thumbnail Upload */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Thumbnail
          </h4>
          {statuteData.thumbnailUrl ? (
            <div className="space-y-2">
              <img
                src={statuteData.thumbnailUrl}
                alt="Statute thumbnail"
                className="w-full h-32 object-cover rounded-lg"
              />
              <button
                onClick={() => thumbnailInputRef.current?.click()}
                className="w-full text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm"
              >
                Replace
              </button>
            </div>
          ) : (
            <button
              onClick={() => thumbnailInputRef.current?.click()}
              disabled={uploadingThumbnail}
              className="w-full py-2 px-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-center gap-2"
            >
              {uploadingThumbnail ? (
                <>
                  <FiRefreshCw className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <FiImage className="w-4 h-4" />
                  Upload Thumbnail
                </>
              )}
            </button>
          )}
          <input
            ref={thumbnailInputRef}
            type="file"
            accept="image/*"
            onChange={handleThumbnailUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* AI Summary Section */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          AI Analysis
        </h4>

        {statuteData.aiSummary && (
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Summary
            </h5>
            <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
              {statuteData.aiSummary}
            </p>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Enter a custom prompt for AI analysis..."
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
              rows={2}
            />
            <button
              onClick={generateAISummary}
              disabled={isGenerating || !statuteData.title}
              className="mt-2 btn-secondary text-sm"
            >
              {isGenerating ? 'Generating...' : 'Generate Summary'}
            </button>
          </div>

          {promptTemplates.length > 0 && (
            <div className="flex gap-2">
              <select
                value={selectedPromptId}
                onChange={(e) => setSelectedPromptId(e.target.value)}
                className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
              >
                <option value="">Select a prompt template...</option>
                {promptTemplates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.title}
                  </option>
                ))}
              </select>
              <button
                onClick={generateCustomAnalysis}
                disabled={isGenerating || !selectedPromptId || !statuteData.title}
                className="btn-secondary text-sm"
              >
                Analyze
              </button>
            </div>
          )}
        </div>

        {/* Custom Analyses */}
        {statuteData.customAnalyses && Object.keys(statuteData.customAnalyses).length > 0 && (
          <div className="mt-4 space-y-3">
            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Custom Analyses
            </h5>
            {Object.entries(statuteData.customAnalyses).map(([id, analysis]) => (
              <div key={id} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h6 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {analysis.prompt}
                  </h6>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(analysis.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                  {analysis.result}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}