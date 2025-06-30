'use client';

import { useState, useRef, useEffect } from 'react';

interface VideoThumbnailSelectorProps {
  videoFile: File;
  onThumbnailSelected: (thumbnailDataUrl: string) => void;
  onClose: () => void;
}

export function VideoThumbnailSelector({ videoFile, onThumbnailSelected, onClose }: VideoThumbnailSelectorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const url = URL.createObjectURL(videoFile);
    setVideoUrl(url);
    
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [videoFile]);

  const captureFrame = (time: number): Promise<string> => {
    return new Promise((resolve) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return resolve('');

      video.currentTime = time;
      video.onseeked = () => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve('');

        // Set canvas size to video dimensions
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert to data URL with reasonable quality
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(dataUrl);
      };
    });
  };

  const generateThumbnails = async () => {
    const video = videoRef.current;
    if (!video) return;

    setIsGenerating(true);
    const frames: string[] = [];

    // Generate thumbnails at different points in the video
    const numThumbnails = 6;
    const interval = video.duration / (numThumbnails + 1);

    for (let i = 1; i <= numThumbnails; i++) {
      const time = interval * i;
      const thumbnail = await captureFrame(time);
      if (thumbnail) {
        frames.push(thumbnail);
      }
    }

    setThumbnails(frames);
    setIsGenerating(false);
  };

  const handleVideoLoaded = () => {
    const video = videoRef.current;
    if (video) {
      setDuration(video.duration);
      generateThumbnails();
    }
  };

  const captureCurrentFrame = async () => {
    const video = videoRef.current;
    if (!video) return;

    const thumbnail = await captureFrame(video.currentTime);
    if (thumbnail) {
      const newThumbnails = [...thumbnails];
      newThumbnails.push(thumbnail);
      setThumbnails(newThumbnails);
      setSelectedIndex(newThumbnails.length - 1);
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video) {
      setCurrentTime(video.currentTime);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Select Video Thumbnail
          </h3>

          {/* Video Preview */}
          <div className="mb-6">
            {videoUrl && (
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full max-h-64 rounded-lg bg-black"
                controls
                onLoadedMetadata={handleVideoLoaded}
                onTimeUpdate={handleTimeUpdate}
              />
            )}
            <canvas ref={canvasRef} className="hidden" />
            
            {/* Video Controls */}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              <button
                onClick={captureCurrentFrame}
                className="text-sm px-3 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700"
              >
                Capture Current Frame
              </button>
            </div>
          </div>

          {/* Thumbnail Grid */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              {isGenerating ? 'Generating thumbnails...' : 'Select a thumbnail:'}
            </h4>
            
            {isGenerating ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {thumbnails.map((thumbnail, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedIndex(index)}
                    className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                      selectedIndex === index
                        ? 'border-brand-600 ring-2 ring-brand-600 ring-offset-2 dark:ring-offset-gray-900'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <img
                      src={thumbnail}
                      alt={`Thumbnail ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {selectedIndex === index && (
                      <div className="absolute inset-0 bg-brand-600/20 flex items-center justify-center">
                        <div className="bg-brand-600 rounded-full p-1">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2 px-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (thumbnails[selectedIndex]) {
                  onThumbnailSelected(thumbnails[selectedIndex]);
                }
              }}
              disabled={!thumbnails.length || isGenerating}
              className="flex-1 py-2 px-4 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
            >
              Use Selected Thumbnail
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}