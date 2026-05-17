"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExternalLink } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface VideoPlayerProps {
  url: string;
  title?: string;
  onVideoEnd?: () => void;
}

/**
 * Parse YouTube URL and extract video ID
 * Supports formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/watch?v=VIDEO_ID&list=PLAYLIST_ID
 */
function getYouTubeEmbedUrl(url: string): string | null {
  try {
    // YouTube regex pattern to extract video ID
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    
    if (match && match[2].length === 11) {
      const videoId = match[2];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing YouTube URL:', error);
    return null;
  }
}

/**
 * Parse Vimeo URL and extract video ID
 * Supports formats:
 * - https://vimeo.com/VIDEO_ID
 * - https://player.vimeo.com/video/VIDEO_ID
 */
function getVimeoEmbedUrl(url: string): string | null {
  try {
    // Vimeo regex pattern to extract video ID
    const regExp = /(?:vimeo\.com\/)(?:.*\/)?(\d+)/;
    const match = url.match(regExp);
    
    if (match && match[1]) {
      const videoId = match[1];
      return `https://player.vimeo.com/video/${videoId}`;
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing Vimeo URL:', error);
    return null;
  }
}

/**
 * Detect video platform and return embed URL
 */
function parseVideoUrl(url: string): { embedUrl: string | null; platform: 'youtube' | 'vimeo' | 'unknown' } {
  if (!url) {
    return { embedUrl: null, platform: 'unknown' };
  }

  // Check YouTube
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    const embedUrl = getYouTubeEmbedUrl(url);
    return { embedUrl, platform: 'youtube' };
  }
  
  // Check Vimeo
  if (url.includes('vimeo.com')) {
    const embedUrl = getVimeoEmbedUrl(url);
    return { embedUrl, platform: 'vimeo' };
  }
  
  return { embedUrl: null, platform: 'unknown' };
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ url, title, onVideoEnd }) => {
  const isMobile = useIsMobile();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  const { embedUrl, platform } = parseVideoUrl(url);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  // If URL cannot be parsed, show error with link to open in new tab
  if (!embedUrl) {
    return (
      <Alert variant="destructive" className={cn(isMobile && "p-3")}>
        <AlertDescription>
          <div className={cn("space-y-3", isMobile && "space-y-2")}>
            <p className={cn("font-medium", isMobile ? "text-base" : "")}>
              Unable to embed video
            </p>
            <p className={cn(isMobile ? "text-sm" : "text-sm")}>
              The video URL format is not recognized. Supported platforms: YouTube, Vimeo
            </p>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium",
                  isMobile ? "text-sm py-2 min-h-[44px]" : "text-sm"
                )}
              >
                <ExternalLink className={cn(isMobile ? "w-4 h-4" : "w-4 h-4")} />
                Open video in new tab
              </a>
            )}
            <p className={cn("text-gray-600 mt-2", isMobile ? "text-xs break-all" : "text-xs")}>
              Original URL: {url}
            </p>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="video-player-container w-full">
      {/* Video Title (Optional) */}
      {title && (
        <div className={cn("mb-3", isMobile && "mb-2")}>
          <h3 className={cn(
            "font-semibold text-gray-900 flex items-center gap-2",
            isMobile ? "text-base" : "text-lg"
          )}>
            🎬 {title}
          </h3>
          <p className={cn("text-gray-600", isMobile ? "text-xs" : "text-sm")}>
            {platform === 'youtube' ? 'YouTube' : platform === 'vimeo' ? 'Vimeo' : 'Video'}
          </p>
        </div>
      )}

      {/* Responsive Video Container (16:9 aspect ratio) */}
      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
            <div className="text-center">
              <div className={cn(
                "animate-spin rounded-full border-b-2 border-blue-600 mx-auto mb-2",
                isMobile ? "h-10 w-10" : "h-12 w-12"
              )}></div>
              <p className={cn("text-gray-600", isMobile ? "text-xs" : "text-sm")}>
                Loading video...
              </p>
            </div>
          </div>
        )}
        
        <iframe
          className="absolute top-0 left-0 w-full h-full rounded-lg shadow-lg"
          src={embedUrl}
          title={title || "Video Player"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          style={{ border: 'none' }}
        />
      </div>

      {/* Error State */}
      {hasError && (
        <Alert variant="destructive" className={cn("mt-4", isMobile && "mt-3 p-3")}>
          <AlertDescription>
            <p className={cn(isMobile ? "text-sm" : "")}>
              Failed to load video. Please check your internet connection or try opening the video directly.
            </p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium mt-2",
                isMobile ? "text-sm py-2 min-h-[44px]" : "text-sm"
              )}
            >
              <ExternalLink className={cn(isMobile ? "w-4 h-4" : "w-4 h-4")} />
              Open in new tab
            </a>
          </AlertDescription>
        </Alert>
      )}

      {/* Helper Text */}
      <div className={cn(
        "text-gray-500 text-center",
        isMobile ? "mt-2 text-xs" : "mt-3 text-xs"
      )}>
        💡 Tip: Watch the complete video to continue to the next lesson
      </div>
    </div>
  );
};

export default VideoPlayer;

