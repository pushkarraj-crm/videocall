'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { HostAssetCatalog } from '@/lib/video-assets/asset-types';
import { EXPECTED_ASSET_TYPES } from '@/lib/video-assets/asset-types';
import { invalidateCatalogCache, listMissingAssets, loadAssetCatalog } from '@/lib/video-assets/asset-manager';

type Props = {
  hostSlug: string;
  outfitSlug?: string;
  sceneSlug?: string;
};

export function AiHostAssetBrowser({
  hostSlug,
  outfitSlug: initialOutfit = 'casual',
  sceneSlug: initialScene = 'bedroom',
}: Props) {
  const [catalog, setCatalog] = useState<HostAssetCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedHost, setSelectedHost] = useState(hostSlug);
  const [outfit, setOutfit] = useState(initialOutfit);
  const [scene, setScene] = useState(initialScene);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      if (force) invalidateCatalogCache();
      const data = await loadAssetCatalog(force);
      setCatalog(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSelectedHost(hostSlug);
  }, [hostSlug]);

  const hostKeys = useMemo(() => Object.keys(catalog?.hosts ?? {}), [catalog]);
  const hostNode = catalog?.hosts[selectedHost];
  const outfitKeys = useMemo(() => Object.keys(hostNode?.outfits ?? {}), [hostNode]);
  const sceneKeys = useMemo(() => {
    if (!hostNode || !outfitKeys.includes(outfit)) return [];
    return Object.keys(hostNode.outfits[outfit]?.scenes ?? {});
  }, [hostNode, outfit, outfitKeys]);

  useEffect(() => {
    if (outfitKeys.length && !outfitKeys.includes(outfit)) setOutfit(outfitKeys[0]);
  }, [outfit, outfitKeys]);

  useEffect(() => {
    if (sceneKeys.length && !sceneKeys.includes(scene)) setScene(sceneKeys[0]);
  }, [scene, sceneKeys]);

  const refresh = async () => {
    try {
      const res = await fetch('/api/ai-hosts/scan', { method: 'POST' });
      if (!res.ok) throw new Error('Scan failed');
      invalidateCatalogCache();
      await load(true);
      toast.success('Assets refreshed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Refresh failed');
    }
  };

  const clips =
    hostNode?.outfits[outfit]?.scenes[scene] ?? [];
  const missing =
    catalog && hostNode ? listMissingAssets(catalog, selectedHost, outfit, scene) : EXPECTED_ASSET_TYPES;

  return (
    <div className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-white">Asset Browser</h3>
          <p className="text-xs text-[#A7A7B3]">
            {catalog?.totalClips ?? 0} clips · scanned{' '}
            {catalog?.scannedAt ? new Date(catalog.scannedAt).toLocaleString() : '—'}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={refresh} disabled={loading}>
          <RefreshCw className="mr-1 h-3 w-3" /> Refresh Assets
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-sm text-white"
          value={selectedHost}
          onChange={(e) => setSelectedHost(e.target.value)}
        >
          {!hostKeys.includes(selectedHost) && (
            <option value={selectedHost}>{selectedHost} (no folder)</option>
          )}
          {hostKeys.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-sm text-white"
          value={outfit}
          onChange={(e) => setOutfit(e.target.value)}
          disabled={!outfitKeys.length}
        >
          {outfitKeys.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-sm text-white"
          value={scene}
          onChange={(e) => setScene(e.target.value)}
          disabled={!sceneKeys.length}
        >
          {sceneKeys.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-medium uppercase text-[#FFB347]">
            Uploaded ({selectedHost}/{outfit}/{scene})
          </p>
          <ul className="max-h-48 space-y-1 overflow-y-auto text-sm text-[#E8E8F0]">
            {clips.map((c) => (
              <li key={c.url}>
                <button
                  type="button"
                  className="text-left hover:text-[#FF2E74]"
                  onClick={() => setPreviewUrl(c.url)}
                >
                  {c.type} — {c.file}
                </button>
              </li>
            ))}
            {!clips.length && !loading && (
              <li className="text-[#A7A7B3]">No clips for this path</li>
            )}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase text-amber-400">Missing Assets</p>
          <ul className="text-sm text-[#A7A7B3]">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
            {!missing.length && <li className="text-emerald-400">All expected types present</li>}
          </ul>
        </div>
      </div>

      {previewUrl && (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <video
            src={previewUrl}
            className="aspect-video w-full object-cover"
            controls
            autoPlay
            muted
            playsInline
          />
        </div>
      )}
    </div>
  );
}