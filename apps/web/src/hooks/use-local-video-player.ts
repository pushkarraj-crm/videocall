'use client';

import { useEffect, useRef, useState } from 'react';
import type { AssetType } from '@/lib/video-assets/asset-types';
import { devLog } from '@/lib/dev-log';
import {
  catalogHasAssets,
  hostHasAssets,
  loadAssetCatalog,
  pickRandomIdleClip,
  resolveAssetHostSlug,
} from '@/lib/video-assets/asset-manager';

export type LocalVideoPlayerState = {
  sessionVideoUrl: string | null;
  assetType: AssetType;
  loop: boolean;
  ready: boolean;
  usingLocalAssets: boolean;
  fallback: boolean;
};

export function useLocalVideoPlayer(params: {
  displayName: string;
  hostSlug?: string;
  outfit?: string;
  scene?: string;
  enabled?: boolean;
  /** Server-selected video URL locked for this call */
  lockedVideoUrl?: string | null;
}) {
  const {
    displayName,
    hostSlug,
    outfit = 'casual',
    scene = 'bedroom',
    enabled = true,
    lockedVideoUrl,
  } = params;

  const sessionLockedRef = useRef<string | null>(null);
  const selectionDoneRef = useRef(false);
  const [sessionVideoUrl, setSessionVideoUrl] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<Awaited<ReturnType<typeof loadAssetCatalog>> | null>(null);
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);

  const lockVideoUrl = (url: string, source: string, isFallback = false) => {
    if (sessionLockedRef.current) return;
    sessionLockedRef.current = url;
    selectionDoneRef.current = true;
    devLog('VIDEO_SELECTED', { url, source });
    setSessionVideoUrl(url);
    setFallback(isFallback);
  };

  useEffect(() => {
    if (!enabled) return;
    void loadAssetCatalog().then(setCatalog);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || selectionDoneRef.current) return;
    if (lockedVideoUrl) {
      lockVideoUrl(lockedVideoUrl, 'server_lock');
    }
  }, [enabled, lockedVideoUrl]);

  useEffect(() => {
    if (!enabled || selectionDoneRef.current || lockedVideoUrl) return;
    if (!catalog) return;

    const host = resolveAssetHostSlug(catalog, displayName, hostSlug, null);
    const picked = pickRandomIdleClip(catalog, host, outfit, scene);
    if (!picked) return;

    lockVideoUrl(picked.url, 'client_random', picked.type !== 'idle');
  }, [enabled, catalog, displayName, hostSlug, lockedVideoUrl, outfit, scene]);

  const host = resolveAssetHostSlug(catalog, displayName, hostSlug, sessionVideoUrl);

  const usingLocalAssets = Boolean(
    enabled &&
      (sessionVideoUrl ||
        lockedVideoUrl ||
        (catalog && hostHasAssets(catalog, host)) ||
        catalogHasAssets(catalog)),
  );

  return {
    state: {
      sessionVideoUrl,
      assetType: 'idle' as AssetType,
      loop: true,
      ready,
      usingLocalAssets,
      fallback,
    } satisfies LocalVideoPlayerState,
    setReady,
    host,
  };
}