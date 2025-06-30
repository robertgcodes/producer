'use client';

import { useState, useRef, useEffect } from 'react';
import { BundleVideo } from '@/types/video';
import { BundleVideosService } from '@/lib/services/bundleVideosService';
import { toast } from 'sonner';

interface VideoEditModalProps {
  video: BundleVideo;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export function VideoEditModal({ video, isOpen, onClose, onUpdate }: VideoEditModalProps) {
  const [title, setTitle] = useState(video.title);
  const [description, setDescription] = useState(video.description || '');
  const [sourceUrl, setSourceUrl] = useState(video.sourceUrl || '');
  const [thumbnailUrl, setThumbnailUrl] = useState(video.thumbnailUrl || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showFrameCapture, setShowFrameCapture] = useState(false);
  const [capturedThumbnail, setCapturedThumbnail] = useState('');
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    setIsUpdating(true);
    try {
      let finalThumbnailUrl = thumbnailUrl;
      
      // Upload captured thumbnail if one was selected
      if (capturedThumbnail && video.type === 'upload') {
        try {
          finalThumbnailUrl = await BundleVideosService.uploadThumbnail(
            capturedThumbnail,
            video.bundleId,
            video.id
          );
        } catch (error) {
          console.error('Error uploading thumbnail:', error);
          toast.error('Failed to upload thumbnail, but continuing with save');
        }
      }
      
      await BundleVideosService.updateVideo(video.id, {
        title,
        description,
        sourceUrl,
        thumbnailUrl: finalThumbnailUrl,
      });
      
      toast.success('Video updated successfully');
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error updating video:', error);
      toast.error('Failed to update video');
    } finally {
      setIsUpdating(false);
    }
  };

  const captureFrame = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to data URL
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedThumbnail(dataUrl);
    setShowFrameCapture(false);
    toast.success('Thumbnail captured');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl max-w-lg w-full p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Edit Video
        </h2>

        <div className="space-y-4">
          {/* Video Preview and Thumbnail */}
          <div className="space-y-3">
            {/* Current Thumbnail */}
            <div className="aspect-video rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
              {capturedThumbnail ? (
                <img
                  src={capturedThumbnail}
                  alt="Captured thumbnail"
                  className="w-full h-full object-cover"
                />
              ) : video.type === 'youtube' && video.youtubeId ? (
                <img
                  src={`https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`}
                  alt={video.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src={video.thumbnailUrl || BundleVideosService.generateVideoThumbnail(video)}
                  alt={video.title}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            
            {/* Frame Capture Button for Uploaded Videos */}
            {video.type === 'upload' && (
              <button
                onClick={() => setShowFrameCapture(!showFrameCapture)}
                className="w-full text-sm px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                {showFrameCapture ? 'Hide Frame Capture' : 'Capture Frame from Video'}
              </button>
            )}
            
            {/* Frame Capture UI */}
            {showFrameCapture && video.type === 'upload' && (
              <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <video
                  ref={videoRef}
                  src={video.url}
                  className="w-full rounded-lg"
                  controls
                  onLoadedMetadata={() => {
                    const video = videoRef.current;
                    if (video) {
                      setVideoLoaded(true);
                      setDuration(video.duration);
                    }
                  }}
                  onTimeUpdate={() => {
                    const video = videoRef.current;
                    if (video) {
                      setCurrentTime(video.currentTime);
                    }
                  }}
                />
                <canvas ref={canvasRef} className="hidden" />
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                  <button
                    onClick={captureFrame}
                    disabled={!videoLoaded}
                    className="text-sm px-3 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
                  >
                    Capture Current Frame
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg resize-none text-gray-900 dark:text-white"
            />
          </div>

          {/* Source URL (only for uploaded videos) */}
          {video.type === 'upload' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Source URL
              </label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="Original source link"
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
              />
            </div>
          )}

          {/* Thumbnail URL (only for external videos) */}
          {video.type === 'url' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Thumbnail URL
              </label>
              <input
                type="url"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="Thumbnail image URL"
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
              />
            </div>
          )}

          {/* Note about captured thumbnail */}
          {capturedThumbnail && video.type === 'upload' && (
            <p className="text-sm text-green-600 dark:text-green-400">
              New thumbnail captured. It will be saved when you click "Save Changes".
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 px-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isUpdating}
            className="flex-1 py-2 px-4 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
          >
            {isUpdating ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}