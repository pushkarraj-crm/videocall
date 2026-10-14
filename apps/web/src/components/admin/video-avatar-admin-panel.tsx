'use client';

import { useState } from 'react';
import { AiHostAssetBrowser } from '@/components/admin/ai-host-asset-browser';
import { VideoAvatar } from '@/components/calls/video-avatar';
import { useVirtualHostAvatar } from '@/hooks/use-virtual-host-avatar';
import type { AdminVirtualHostItem } from '@/lib/api/admin';
import { adminApi } from '@/lib/api/admin';
import { slugifyHost } from '@/lib/video-assets/asset-manager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

type Tab = 'avatar' | 'wardrobe' | 'animations' | 'camera' | 'assets' | 'preview';

export function VideoAvatarAdminPanel({ host }: { host: AdminVirtualHostItem }) {
  const [tab, setTab] = useState<Tab>('preview');
  const [videoForm, setVideoForm] = useState({
    enabled: true,
    renderMode: 'cinematic' as 'cinematic' | 'video',
    cameraMode: 'auto' as 'close' | 'medium' | 'portrait' | 'auto',
    autoZoom: true,
    lipSyncMode: 'phoneme' as 'phoneme' | 'energy',
    idleDrift: true,
    eyeTracking: true,
  });
  const [outfitForm, setOutfitForm] = useState({
    id: 'outfit_casual_1',
    name: 'Casual Look',
    category: 'casual',
    imageUrl: host.user.avatarUrl ?? '',
  });
  const [previewMode, setPreviewMode] = useState<'idle' | 'speaking' | 'thinking' | 'gift'>('idle');

  const avatarAnim = useVirtualHostAvatar({
    settings: { expressionIntensity: 0.8, lipSyncIntensity: 0.8 },
    emotion: previewMode === 'gift' ? 'excited' : 'happy',
    speaking: previewMode === 'speaking',
    thinking: previewMode === 'thinking',
    connected: true,
    giftCategory: previewMode === 'gift' ? 'luxury' : null,
    giftTier: previewMode === 'gift' ? 'fullscreen' : null,
  });

  const saveVideo = async () => {
    try {
      await adminApi.updateVirtualHostVideo(host.hostId, videoForm);
      toast.success('Video settings saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    }
  };

  const saveWardrobe = async () => {
    try {
      await adminApi.updateVirtualHostWardrobe(host.hostId, {
        activeOutfitId: outfitForm.id,
        outfits: [{ ...outfitForm, approved: true }],
      });
      toast.success('Wardrobe saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Wardrobe save failed');
    }
  };

  const tabs: Tab[] = ['avatar', 'wardrobe', 'animations', 'camera', 'assets', 'preview'];

  return (
    <div className="mt-3 w-full rounded-lg border border-[#FF2E74]/20 bg-black/30 p-3">
      <div className="mb-3 flex flex-wrap gap-1">
        {tabs.map((t) => (
          <Button
            key={t}
            size="sm"
            variant={tab === t ? 'secondary' : 'ghost'}
            className="capitalize"
            onClick={() => setTab(t)}
          >
            {t}
          </Button>
        ))}
      </div>

      {tab === 'avatar' && (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-[#A7A7B3]">
            <input
              type="checkbox"
              checked={videoForm.enabled}
              onChange={(e) => setVideoForm({ ...videoForm, enabled: e.target.checked })}
            />
            Video avatar enabled
          </label>
          <Input
            placeholder="Render mode (cinematic, video)"
            value={videoForm.renderMode}
            onChange={(e) =>
              setVideoForm({ ...videoForm, renderMode: e.target.value as 'cinematic' | 'video' })
            }
          />
          <Button size="sm" variant="outline" onClick={saveVideo}>
            Save avatar
          </Button>
        </div>
      )}

      {tab === 'wardrobe' && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            placeholder="Outfit ID"
            value={outfitForm.id}
            onChange={(e) => setOutfitForm({ ...outfitForm, id: e.target.value })}
          />
          <Input
            placeholder="Name"
            value={outfitForm.name}
            onChange={(e) => setOutfitForm({ ...outfitForm, name: e.target.value })}
          />
          <Input
            placeholder="Category (casual, party, business…)"
            value={outfitForm.category}
            onChange={(e) => setOutfitForm({ ...outfitForm, category: e.target.value })}
          />
          <Input
            placeholder="Image URL"
            value={outfitForm.imageUrl}
            onChange={(e) => setOutfitForm({ ...outfitForm, imageUrl: e.target.value })}
          />
          <Button size="sm" variant="outline" onClick={saveWardrobe}>
            Save wardrobe
          </Button>
        </div>
      )}

      {tab === 'animations' && (
        <p className="text-sm text-[#A7A7B3]">
          Poses: idle, talking, listening, laughing, thinking, celebrating — synced from conversation,
          voice, emotion, and gifts.
        </p>
      )}

      {tab === 'camera' && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            placeholder="Camera (close, medium, portrait, auto)"
            value={videoForm.cameraMode}
            onChange={(e) =>
              setVideoForm({
                ...videoForm,
                cameraMode: e.target.value as 'close' | 'medium' | 'portrait' | 'auto',
              })
            }
          />
          <label className="flex items-center gap-2 text-sm text-[#A7A7B3]">
            <input
              type="checkbox"
              checked={videoForm.autoZoom}
              onChange={(e) => setVideoForm({ ...videoForm, autoZoom: e.target.checked })}
            />
            Auto zoom / dynamic framing
          </label>
          <Button size="sm" variant="outline" onClick={saveVideo}>
            Save camera
          </Button>
        </div>
      )}

      {tab === 'assets' && (
        <AiHostAssetBrowser
          hostSlug={slugifyHost(host.user.displayName)}
          outfitSlug="casual"
          sceneSlug="bedroom"
        />
      )}

      {tab === 'preview' && (
        <div className="flex flex-col items-center gap-3">
          <VideoAvatar
            displayName={host.user.displayName}
            imageUrl={outfitForm.imageUrl || host.user.avatarUrl}
            avatarState={avatarAnim.state}
            settings={videoForm}
            outfit={{ ...outfitForm, approved: true }}
            emotion="happy"
            speaking={previewMode === 'speaking'}
            thinking={previewMode === 'thinking'}
            subtitle="Hello! Nice to meet you today."
          />
          <div className="flex flex-wrap gap-2">
            {(['idle', 'speaking', 'thinking', 'gift'] as const).map((m) => (
              <Button
                key={m}
                size="sm"
                variant={previewMode === m ? 'secondary' : 'outline'}
                onClick={() => setPreviewMode(m)}
              >
                {m}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}