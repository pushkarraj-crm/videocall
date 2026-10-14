'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { devLog } from '@/lib/dev-log';
import { cn } from '@/lib/utils';

interface LocalVideoPlayerProps {
  videoUrl: string | null;
  className?: string;
}

function LocalVideoPlayerInner({ videoUrl, className }: LocalVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const boundUrlRef = useRef<string | null>(null);
  const [boundUrl, setBoundUrl] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!videoUrl) return;
    if (boundUrlRef.current) {
      if (boundUrlRef.current !== videoUrl) {
        devLog('VIDEO_SOURCE_CHANGED', { from: boundUrlRef.current, to: videoUrl });
      }
      return;
    }
    boundUrlRef.current = videoUrl;
    setBoundUrl(videoUrl);
  }, [videoUrl]);

  useEffect(() => {
    devLog('VIDEO_MOUNT', { url: boundUrlRef.current });
    return () => {
      devLog('VIDEO_UNMOUNT', { url: boundUrlRef.current });
      const el = videoRef.current;
      if (el) {
        el.pause();
        el.removeAttribute('src');
        el.load();
      }
    };
  }, []);

  const handleCanPlay = useCallback(() => {
    devLog('VIDEO_CANPLAY', { url: boundUrlRef.current });
    setReady(true);
    const el = videoRef.current;
    if (!el || el.paused === false) return;
    void el.play()
      .then(() => devLog('VIDEO_PLAY', { url: boundUrlRef.current }))
      .catch(() => undefined);
  }, []);

  return (
    <div
      className={cn('relative h-full w-full overflow-hidden bg-[#121218]', className)}
      style={{ transform: 'translateZ(0)' }}
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-0 z-10 bg-[#121218] transition-opacity duration-500',
          ready ? 'opacity-0' : 'opacity-100',
        )}
        aria-hidden
      />
      <video
        ref={videoRef}
        className={cn(
          'absolute inset-0 h-full w-full object-cover transition-opacity duration-500',
          ready ? 'opacity-100' : 'opacity-0',
        )}
        style={{ transform: 'translateZ(0)' }}
        src={boundUrl ?? undefined}
        autoPlay
        muted
        playsInline
        loop
        preload="auto"
        onCanPlay={handleCanPlay}
        onLoadedData={handleCanPlay}
      />
    </div>
  );
}

export const LocalVideoPlayer = memo(
  LocalVideoPlayerInner,
  (prev, next) => prev.videoUrl === next.videoUrl && prev.className === next.className,
);