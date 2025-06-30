'use client';

import { useState, useEffect, useRef } from 'react';
import { Bundle, ContentItem } from '@/types';
import { BundleVideo } from '@/types/video';
import { BundleVideosService } from '@/lib/services/bundleVideosService';
import { VideoPlayerModal } from '../VideoPlayerModal';
import { VideoThumbnailSelector } from '../VideoThumbnailSelector';
import { VideoEditModal } from '../VideoEditModal';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getDownloadURL } from 'firebase/storage';

interface VideosTabProps {
  bundle: Bundle;
  stories: ContentItem[];
}

export function VideosTab({ bundle, stories }: VideosTabProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [videos, setVideos] = useState<BundleVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<BundleVideo | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addType, setAddType] = useState<'upload' | 'youtube' | 'url'>('youtube');
  
  // Form state
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoThumbnail, setVideoThumbnail] = useState('');
  const [videoSourceUrl, setVideoSourceUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showThumbnailSelector, setShowThumbnailSelector] = useState(false);
  const [customThumbnailDataUrl, setCustomThumbnailDataUrl] = useState('');
  const [editingVideo, setEditingVideo] = useState<BundleVideo | null>(null);

  useEffect(() => {
    loadVideos();
  }, [bundle.id]);

  const loadVideos = async () => {
    try {
      const bundleVideos = await BundleVideosService.getBundleVideos(bundle.id);
      setVideos(bundleVideos);
    } catch (error) {
      console.error('Error loading videos:', error);
      toast.error('Failed to load videos');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!user) return;

    // Validate file type
    if (!file.type.startsWith('video/')) {
      toast.error('Please select a video file');
      return;
    }

    // Validate file size (500MB limit)
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('Video file must be less than 500MB');
      return;
    }

    setUploadProgress(0);

    try {
      const uploadTask = BundleVideosService.uploadVideo(
        file,
        bundle.id,
        user.uid,
        (progress) => {
          setUploadProgress(Math.round(progress.percentage));
        }
      );

      const snapshot = await uploadTask;
      const downloadUrl = await getDownloadURL(snapshot.ref);

      // Get the highest order value
      const maxOrder = videos.length > 0 
        ? Math.max(...videos.map(v => v.order || 0)) 
        : -1;

      // Generate a temporary video ID for thumbnail upload
      const tempVideoId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Upload custom thumbnail if one was selected
      let finalThumbnailUrl = videoThumbnail;
      if (customThumbnailDataUrl) {
        try {
          finalThumbnailUrl = await BundleVideosService.uploadThumbnail(
            customThumbnailDataUrl,
            bundle.id,
            tempVideoId
          );
        } catch (error) {
          console.error('Error uploading thumbnail:', error);
          // Continue without custom thumbnail
        }
      }

      // Save video metadata
      const videoId = await BundleVideosService.saveVideo({
        bundleId: bundle.id,
        type: 'upload',
        title: videoTitle || file.name,
        description: videoDescription,
        url: downloadUrl,
        sourceUrl: videoSourceUrl,
        thumbnailUrl: finalThumbnailUrl,
        uploadedAt: new Date(),
        uploadedBy: user.uid,
        order: maxOrder + 1,
        metadata: {
          size: file.size,
          mimeType: file.type,
        }
      });

      toast.success('Video uploaded successfully');
      setShowAddModal(false);
      resetForm();
      loadVideos();
    } catch (error) {
      console.error('Error uploading video:', error);
      toast.error('Failed to upload video');
    } finally {
      setUploadProgress(null);
    }
  };

  const handleAddYouTubeVideo = async () => {
    if (!user) return;

    if (!videoUrl || !videoTitle) {
      toast.error('Please provide a YouTube URL and title');
      return;
    }

    try {
      await BundleVideosService.addYouTubeVideo(
        bundle.id,
        videoUrl,
        videoTitle,
        videoDescription,
        user.uid
      );

      toast.success('YouTube video added successfully');
      setShowAddModal(false);
      resetForm();
      loadVideos();
    } catch (error) {
      console.error('Error adding YouTube video:', error);
      toast.error('Failed to add YouTube video');
    }
  };

  const handleAddExternalVideo = async () => {
    if (!user) return;

    if (!videoUrl || !videoTitle) {
      toast.error('Please provide a video URL and title');
      return;
    }

    try {
      await BundleVideosService.addExternalVideo(
        bundle.id,
        videoUrl,
        videoTitle,
        videoDescription,
        videoThumbnail,
        user.uid
      );

      toast.success('Video added successfully');
      setShowAddModal(false);
      resetForm();
      loadVideos();
    } catch (error) {
      console.error('Error adding video:', error);
      toast.error('Failed to add video');
    }
  };

  const handleDeleteVideo = async (video: BundleVideo) => {
    if (confirm('Are you sure you want to delete this video?')) {
      try {
        await BundleVideosService.deleteVideo(video);
        toast.success('Video deleted');
        loadVideos();
      } catch (error) {
        console.error('Error deleting video:', error);
        toast.error('Failed to delete video');
      }
    }
  };

  const resetForm = () => {
    setVideoTitle('');
    setVideoDescription('');
    setVideoUrl('');
    setVideoThumbnail('');
    setVideoSourceUrl('');
    setSelectedFile(null);
    setCustomThumbnailDataUrl('');
    setAddType('youtube');
  };

  const renderAddModal = () => {
    if (!showAddModal) return null;

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl max-w-lg w-full p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Add Video</h2>

          {/* Type Selection */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setAddType('youtube')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                addType === 'youtube'
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              YouTube
            </button>
            <button
              onClick={() => setAddType('upload')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                addType === 'upload'
                  ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              Upload
            </button>
            <button
              onClick={() => setAddType('url')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                addType === 'url'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              External URL
            </button>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            {addType === 'upload' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Video File</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setSelectedFile(file);
                      setVideoTitle(file.name.replace(/\.[^/.]+$/, ''));
                    }
                  }}
                  className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 dark:file:bg-brand-900/50 dark:file:text-brand-300"
                />
                {selectedFile && (
                  <button
                    type="button"
                    onClick={() => setShowThumbnailSelector(true)}
                    className="mt-2 text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                  >
                    {customThumbnailDataUrl ? 'Change thumbnail' : 'Select thumbnail from video'}
                  </button>
                )}
                {uploadProgress !== null && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>Uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-brand-600 h-2 rounded-full transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {(addType === 'youtube' || addType === 'url') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {addType === 'youtube' ? 'YouTube URL' : 'Video URL'}
                </label>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder={addType === 'youtube' ? 'https://youtube.com/watch?v=...' : 'https://example.com/video.mp4'}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Title</label>
              <input
                type="text"
                value={videoTitle}
                onChange={(e) => setVideoTitle(e.target.value)}
                placeholder="Video title"
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description (optional)</label>
              <textarea
                value={videoDescription}
                onChange={(e) => setVideoDescription(e.target.value)}
                placeholder="Video description"
                rows={3}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg resize-none text-gray-900 dark:text-white"
              />
            </div>

            {addType === 'upload' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Source URL (optional)</label>
                <input
                  type="url"
                  value={videoSourceUrl}
                  onChange={(e) => setVideoSourceUrl(e.target.value)}
                  placeholder="Original source link (e.g., Twitter post, news article)"
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                />
              </div>
            )}

            {addType === 'url' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Thumbnail URL (optional)</label>
                <input
                  type="url"
                  value={videoThumbnail}
                  onChange={(e) => setVideoThumbnail(e.target.value)}
                  placeholder="https://example.com/thumbnail.jpg"
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => {
                setShowAddModal(false);
                resetForm();
              }}
              className="flex-1 py-2 px-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (addType === 'upload') {
                  if (selectedFile) await handleFileUpload(selectedFile);
                } else if (addType === 'youtube') {
                  await handleAddYouTubeVideo();
                } else {
                  await handleAddExternalVideo();
                }
              }}
              disabled={uploadProgress !== null}
              className="flex-1 py-2 px-4 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
            >
              {uploadProgress !== null ? 'Uploading...' : 'Add Video'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Bundle Videos</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Upload videos or add YouTube links to your research bundle
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Video
          </button>
        </div>

        {/* Videos Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
          </div>
        ) : videos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <div key={video.id} className="bg-white dark:bg-gray-900 rounded-xl shadow-sm overflow-hidden group">
                <div className="relative aspect-video">
                  <img
                    src={video.thumbnailUrl || BundleVideosService.generateVideoThumbnail(video)}
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                    <button
                      onClick={() => setSelectedVideo(video)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <div className="p-3 bg-white rounded-full shadow-lg">
                        <svg className="w-6 h-6 text-gray-900" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </button>
                  </div>
                  {/* Type Badge */}
                  <div className="absolute top-2 left-2">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      video.type === 'youtube' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                      video.type === 'upload' ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' :
                      'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    }`}>
                      {video.type === 'youtube' ? 'YouTube' : video.type === 'upload' ? 'Uploaded' : 'External'}
                    </span>
                  </div>
                  {/* Action Buttons */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Download Button (only for uploaded videos) */}
                    {video.type === 'upload' && (
                      <a
                        href={video.url}
                        download={video.title}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                        title="Download video"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </a>
                    )}
                    {/* Edit Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingVideo(video);
                      }}
                      className="p-1.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                      title="Edit video"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    {/* Delete Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteVideo(video);
                      }}
                      className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600"
                      title="Delete video"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-medium text-gray-900 dark:text-white line-clamp-2 mb-2">
                    {video.title}
                  </h3>
                  {video.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                      {video.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{new Date(video.uploadedAt).toLocaleDateString()}</span>
                    {video.metadata?.size && (
                      <span>{(video.metadata.size / (1024 * 1024)).toFixed(1)} MB</span>
                    )}
                  </div>
                  {/* Source Link for YouTube and uploaded videos */}
                  {(video.sourceUrl || video.type === 'youtube') && (
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                      <a
                        href={video.type === 'youtube' ? video.url : video.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        {video.type === 'youtube' ? 'View on YouTube' : 'View Source'}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <svg className="w-16 h-16 text-gray-300 dark:text-gray-700 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400 mb-2">No videos yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Upload videos or add YouTube links to get started
            </p>
          </div>
        )}
      </div>

      {/* Add Video Modal */}
      {renderAddModal()}

      {/* Video Player Modal */}
      {selectedVideo && (
        <VideoPlayerModal
          video={selectedVideo}
          isOpen={!!selectedVideo}
          onClose={() => setSelectedVideo(null)}
        />
      )}

      {/* Thumbnail Selector Modal */}
      {showThumbnailSelector && selectedFile && (
        <VideoThumbnailSelector
          videoFile={selectedFile}
          onThumbnailSelected={(dataUrl) => {
            setCustomThumbnailDataUrl(dataUrl);
            setShowThumbnailSelector(false);
            toast.success('Thumbnail selected');
          }}
          onClose={() => setShowThumbnailSelector(false)}
        />
      )}

      {/* Video Edit Modal */}
      {editingVideo && (
        <VideoEditModal
          video={editingVideo}
          isOpen={!!editingVideo}
          onClose={() => setEditingVideo(null)}
          onUpdate={() => {
            loadVideos();
            setEditingVideo(null);
          }}
        />
      )}
    </div>
  );
}