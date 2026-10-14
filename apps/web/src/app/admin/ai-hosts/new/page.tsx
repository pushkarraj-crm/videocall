'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/lib/api/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function NewAiHostPage() {
  const router = useRouter();
  const profileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [form, setForm] = useState({
    hostName: '',
    displayName: '',
    username: '',
    age: '22',
    country: 'IN',
    languages: 'en',
    bio: '',
    avatarUrl: '',
    online: true,
    enabled: true,
  });

  const save = async () => {
    if (!form.displayName.trim()) {
      toast.error('Display name is required');
      return;
    }
    setSaving(true);
    try {
      const langs = form.languages.split(',').map((s) => s.trim()).filter(Boolean);
      const created = await adminApi.createVirtualHost({
        displayName: form.displayName.trim(),
        hostName: form.hostName.trim() || form.displayName.trim(),
        virtualHostUsername: form.username.trim() || undefined,
        age: Number(form.age) || 22,
        country: form.country.trim() || 'IN',
        languages: langs.length ? langs : ['en'],
        bio: form.bio.trim() || undefined,
        avatarUrl: form.avatarUrl.trim() || undefined,
        profileType: 'AI_HOST',
        virtualHostEnabled: form.enabled,
        virtualHostStatus: form.online ? 'ONLINE' : 'OFFLINE',
        primaryLanguage: langs[0] ?? 'en',
        virtualHostLanguage: langs[0] ?? 'en',
        virtualHostRegion: form.country.trim() || 'IN',
        gender: 'female',
      });

      if (profileFile) {
        await adminApi.uploadAiHostProfileImage(created.hostId, profileFile);
      }
      for (const file of galleryFiles) {
        await adminApi.uploadAiHostGallery(created.hostId, file);
      }

      toast.success('AI host created — asset folder ready');
      router.push(`/admin/ai-hosts/${created.hostId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <Link
        href="/admin/ai-hosts"
        className="inline-flex items-center gap-1 text-sm text-[#A7A7B3] hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to AI Hosts
      </Link>

      <h1 className="text-2xl font-bold text-white">Add AI Host</h1>

      <div className="space-y-4 rounded-2xl border border-white/10 bg-[#17171C] p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm">
            <span className="text-[#A7A7B3]">Host Name</span>
            <Input
              value={form.hostName}
              onChange={(e) => setForm({ ...form, hostName: e.target.value })}
              placeholder="Anjali Sharma"
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-[#A7A7B3]">Display Name *</span>
            <Input
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              placeholder="Anjali"
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-[#A7A7B3]">Username</span>
            <Input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="anjali"
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-[#A7A7B3]">Age</span>
            <Input
              type="number"
              min={18}
              max={99}
              value={form.age}
              onChange={(e) => setForm({ ...form, age: e.target.value })}
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-[#A7A7B3]">Country</span>
            <Input
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              placeholder="IN"
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-[#A7A7B3]">Languages (comma-separated)</span>
            <Input
              value={form.languages}
              onChange={(e) => setForm({ ...form, languages: e.target.value })}
              placeholder="en, hi"
            />
          </label>
        </div>

        <label className="block space-y-1.5 text-sm">
          <span className="text-[#A7A7B3]">Bio</span>
          <textarea
            className="w-full rounded-lg border border-white/10 bg-[#0F0F12] px-3 py-2 text-white"
            rows={3}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
          />
        </label>

        <div className="space-y-3">
          <span className="text-sm text-[#A7A7B3]">Profile Image</span>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-white/20 px-4 py-3 text-sm text-[#A7A7B3] hover:border-[#FF2E74]/50">
            <Upload className="h-4 w-4" />
            {profileFile ? profileFile.name : 'Upload profile photo'}
            <input
              ref={profileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setProfileFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="text-[#A7A7B3]">Or profile image URL</span>
            <Input
              value={form.avatarUrl}
              onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })}
              placeholder="https://…"
            />
          </label>
        </div>

        <div className="space-y-3">
          <span className="text-sm text-[#A7A7B3]">Gallery Images</span>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-white/20 px-4 py-3 text-sm text-[#A7A7B3] hover:border-[#FF2E74]/50">
            <Upload className="h-4 w-4" />
            {galleryFiles.length
              ? `${galleryFiles.length} image(s) selected`
              : 'Upload gallery images'}
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => setGalleryFiles(Array.from(e.target.files ?? []))}
            />
          </label>
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
            Active (visible in Discover)
          </label>
        </div>

        <p className="text-xs text-[#A7A7B3]">
          Saving automatically creates{' '}
          <code className="text-[#FFB347]">public/ai-hosts/&#123;slug&#125;/casual/bedroom/</code>{' '}
          and updates the video manifest.
        </p>

        <Button className="gradient-primary w-full border-0" disabled={saving} onClick={() => void save()}>
          {saving ? 'Creating…' : 'Save AI Host'}
        </Button>
      </div>
    </div>
  );
}