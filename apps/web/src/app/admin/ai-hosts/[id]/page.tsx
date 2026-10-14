'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Upload, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  adminApi,
  type AdminVirtualHostItem,
  type AiHostAssetsResponse,
} from '@/lib/api/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageLoader } from '@/components/shared/page-loader';

export default function EditAiHostPage() {
  const { id } = useParams<{ id: string }>();
  const [host, setHost] = useState<AdminVirtualHostItem | null>(null);
  const [assets, setAssets] = useState<AiHostAssetsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [form, setForm] = useState({
    displayName: '',
    username: '',
    age: '',
    country: '',
    languages: '',
    bio: '',
    avatarUrl: '',
    online: true,
    enabled: true,
    coinsPerMinute: '5',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [h, a] = await Promise.all([
        adminApi.getVirtualHost(id),
        adminApi.getAiHostAssets(id),
      ]);
      setHost(h);
      setAssets(a);
      setForm({
        displayName: h.user.displayName,
        username: h.virtualHostUsername ?? '',
        age: h.age != null ? String(h.age) : '',
        country: h.virtualHostRegion ?? '',
        languages: (h.languages ?? []).join(', '),
        bio: h.user.bio ?? '',
        avatarUrl: h.user.avatarUrl ?? '',
        online: h.virtualHostStatus === 'ONLINE',
        enabled: h.virtualHostEnabled,
        coinsPerMinute: h.coinsPerMinute != null ? String(h.coinsPerMinute) : '5',
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load host');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const langs = form.languages.split(',').map((s) => s.trim()).filter(Boolean);
      await adminApi.updateVirtualHost(id, {
        displayName: form.displayName.trim(),
        virtualHostUsername: form.username.trim() || null,
        age: Number(form.age) || undefined,
        country: form.country.trim() || undefined,
        languages: langs,
        bio: form.bio.trim() || undefined,
        avatarUrl: form.avatarUrl.trim() || null,
        virtualHostEnabled: form.enabled,
        virtualHostStatus: form.online ? 'ONLINE' : 'OFFLINE',
        primaryLanguage: langs[0],
        virtualHostLanguage: langs[0],
        virtualHostRegion: form.country.trim(),
        coinsPerMinute: Number(form.coinsPerMinute) || 5,
      });
      toast.success('Profile saved');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const onVideoUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadingVideo(true);
    try {
      for (const file of Array.from(files)) {
        await adminApi.uploadAiHostVideo(id, file);
      }
      await adminApi.refreshAiHostAssets(id);
      toast.success('Videos uploaded');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Video upload failed');
    } finally {
      setUploadingVideo(false);
    }
  };

  const onProfileUpload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploadingProfile(true);
    try {
      await adminApi.uploadAiHostProfileImage(id, file);
      toast.success('Profile image updated');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Profile upload failed');
    } finally {
      setUploadingProfile(false);
    }
  };

  const onGalleryUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadingGallery(true);
    try {
      for (const file of Array.from(files)) {
        await adminApi.uploadAiHostGallery(id, file);
      }
      toast.success('Gallery images uploaded');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gallery upload failed');
    } finally {
      setUploadingGallery(false);
    }
  };

  const removeGalleryImage = async (imageId: string) => {
    try {
      await adminApi.deleteAiHostGalleryImage(id, imageId);
      toast.success('Image removed');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Remove failed');
    }
  };

  const removeVideo = async (filename: string) => {
    try {
      await adminApi.deleteAiHostVideo(id, filename);
      await adminApi.refreshAiHostAssets(id);
      toast.success('Video removed');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Remove failed');
    }
  };

  if (loading || !host) return <PageLoader />;

  const gallery = assets?.gallery ?? host.virtualHostGallery ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 pb-16">
      <Link
        href="/admin/ai-hosts"
        className="inline-flex items-center gap-1 text-sm text-[#A7A7B3] hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        AI Hosts
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{host.user.displayName}</h1>
          <p className="text-sm text-[#A7A7B3]">
            Slug: <code className="text-[#FFB347]">{host.virtualHostAssetSlug ?? '—'}</code> ·{' '}
            {assets?.videoCount ?? 0} videos
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      <section className="space-y-4 rounded-2xl border border-white/10 bg-[#17171C] p-6">
        <h2 className="font-semibold text-white">Profile</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm sm:col-span-2">
            <span className="text-[#A7A7B3]">Display Name</span>
            <Input
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-[#A7A7B3]">Username</span>
            <Input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-[#A7A7B3]">Age</span>
            <Input
              type="number"
              value={form.age}
              onChange={(e) => setForm({ ...form, age: e.target.value })}
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-[#A7A7B3]">Country</span>
            <Input
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-[#A7A7B3]">Languages</span>
            <Input
              value={form.languages}
              onChange={(e) => setForm({ ...form, languages: e.target.value })}
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-[#A7A7B3]">Coins per minute</span>
            <Input
              type="number"
              min={1}
              max={100}
              value={form.coinsPerMinute}
              onChange={(e) => setForm({ ...form, coinsPerMinute: e.target.value })}
            />
          </label>
          <label className="space-y-1.5 text-sm sm:col-span-2">
            <span className="text-[#A7A7B3]">Bio</span>
            <textarea
              className="w-full rounded-lg border border-white/10 bg-[#0F0F12] px-3 py-2 text-white"
              rows={3}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
            />
          </label>
          <div className="space-y-2 sm:col-span-2">
            <span className="text-sm text-[#A7A7B3]">Profile Image</span>
            {form.avatarUrl && (
              <img
                src={form.avatarUrl}
                alt=""
                className="h-20 w-20 rounded-xl object-cover"
              />
            )}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-white/20 px-4 py-3 text-sm text-[#A7A7B3] hover:border-[#FF2E74]/50">
              <Upload className="h-4 w-4" />
              {uploadingProfile ? 'Uploading…' : 'Upload profile photo'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingProfile}
                onChange={(e) => void onProfileUpload(e.target.files)}
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-[#A7A7B3]">Or image URL</span>
              <Input
                value={form.avatarUrl}
                onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })}
              />
            </label>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2 text-white">
            <input
              type="checkbox"
              checked={form.online}
              onChange={(e) => setForm({ ...form, online: e.target.checked })}
            />
            Online
          </label>
          <label className="flex items-center gap-2 text-white">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            />
            Active
          </label>
        </div>
        <Button disabled={saving} onClick={() => void saveProfile()}>
          {saving ? 'Saving…' : 'Save Profile'}
        </Button>
      </section>

      <section className="space-y-4 rounded-2xl border border-white/10 bg-[#17171C] p-6">
        <h2 className="font-semibold text-white">Gallery</h2>
        <div className="flex flex-wrap gap-2">
          {gallery.map((img) => (
            <div key={img.id} className="group relative">
              <img src={img.url} alt="" className="h-20 w-20 rounded-lg object-cover" />
              <button
                type="button"
                className="absolute right-1 top-1 rounded bg-black/70 p-1 opacity-0 transition group-hover:opacity-100"
                onClick={() => void removeGalleryImage(img.id)}
              >
                <Trash2 className="h-3 w-3 text-red-400" />
              </button>
            </div>
          ))}
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-white/20 px-4 py-3 text-sm text-[#A7A7B3] hover:border-[#FF2E74]/50">
          <Upload className="h-4 w-4" />
          {uploadingGallery ? 'Uploading…' : 'Upload gallery images'}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={uploadingGallery}
            onChange={(e) => void onGalleryUpload(e.target.files)}
          />
        </label>
      </section>

      <section className="space-y-4 rounded-2xl border border-white/10 bg-[#17171C] p-6">
        <h2 className="font-semibold text-white">Videos</h2>
        <p className="text-xs text-[#A7A7B3]">
          Upload MP4 idle clips (e.g. idle_01.mp4). Manifest updates automatically.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(assets?.videos ?? []).map((v) => (
            <div
              key={v.filename}
              className="group relative flex items-center justify-between rounded-lg bg-[#0F0F12] px-3 py-2 text-sm"
            >
              <span className="truncate text-white">{v.filename}</span>
              <div className="flex items-center gap-2">
                <a href={v.url} target="_blank" rel="noreferrer" className="text-xs text-[#FFB347]">
                  Preview
                </a>
                <button
                  type="button"
                  className="rounded bg-black/70 p-1 opacity-0 transition group-hover:opacity-100"
                  onClick={() => void removeVideo(v.filename)}
                >
                  <Trash2 className="h-3 w-3 text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-white/20 px-4 py-3 text-sm text-[#A7A7B3] hover:border-[#FF2E74]/50">
          <Upload className="h-4 w-4" />
          {uploadingVideo ? 'Uploading…' : 'Upload MP4 videos'}
          <input
            type="file"
            accept="video/mp4,video/webm"
            multiple
            className="hidden"
            disabled={uploadingVideo}
            onChange={(e) => void onVideoUpload(e.target.files)}
          />
        </label>
      </section>
    </div>
  );
}