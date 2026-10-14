'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, Trash2, User } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageLoader } from '@/components/shared/page-loader';
import { SettingsPageShell } from '@/components/settings/settings-page-shell';
import { SettingsBackHeader } from '@/components/settings/settings-back-header';
import { usersApi, type EditableProfile } from '@/lib/api/users';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp';

function firstName(displayName: string) {
  return displayName.trim().split(/\s+/)[0] || displayName;
}

export default function EditProfilePage() {
  const setProfile = useAuthStore((s) => s.setProfile);
  const authProfile = useAuthStore((s) => s.profile);
  const [data, setData] = useState<EditableProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [hostBio, setHostBio] = useState('');
  const [gallery, setGallery] = useState<
    Array<{ id: string; url: string; filename?: string; uploadedAt?: string }>
  >([]);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const p = await usersApi.getEditableProfile();
      if (!p?.id || !p.displayName) {
        throw new Error('Profile response was empty or incomplete');
      }
      setData(p);
      setDisplayName(p.displayName ?? '');
      setBio(p.bio ?? '');
      setHostBio(p.hostBio ?? '');
      setGallery(p.gallery ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load profile';
      if (process.env.NODE_ENV === 'development') {
        console.error('[EditProfile] load failed', {
          message,
          statusCode: err && typeof err === 'object' && 'statusCode' in err ? (err as { statusCode: number }).statusCode : undefined,
          code: err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined,
          err,
        });
      }
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const validateFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file (JPG, PNG, or WebP)');
      return false;
    }
    if (file.size > MAX_BYTES) {
      toast.error('Image must be 5MB or smaller');
      return false;
    }
    return true;
  };

  const onAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !validateFile(file)) return;
    setUploading(true);
    try {
      const res = await usersApi.uploadAvatar(file);
      setData((d) => (d ? { ...d, avatarUrl: res.avatarUrl } : d));
      if (authProfile) {
        setProfile({ ...authProfile, avatarUrl: res.avatarUrl });
      }
      toast.success('Profile photo updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = async () => {
    setUploading(true);
    try {
      await usersApi.clearAvatar();
      setData((d) => (d ? { ...d, avatarUrl: null } : d));
      if (authProfile) setProfile({ ...authProfile, avatarUrl: null });
      toast.success('Profile photo removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove photo');
    } finally {
      setUploading(false);
    }
  };

  const onGalleryAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !validateFile(file)) return;
    setUploading(true);
    try {
      const res = await usersApi.uploadGallery(file);
      setGallery(res.gallery);
      toast.success('Photo added to gallery');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gallery upload failed');
    } finally {
      setUploading(false);
    }
  };

  const removeGalleryImage = async (id: string) => {
    setUploading(true);
    try {
      const res = await usersApi.removeGalleryImage(id);
      setGallery(res.gallery);
      toast.success('Photo removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove photo');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (displayName.trim().length < 2) {
      toast.error('Name must be at least 2 characters');
      return;
    }
    setSaving(true);
    try {
      const updated = await usersApi.updateMe({
        displayName: displayName.trim(),
        bio: bio.trim() || undefined,
        ...(data?.isHost ? { hostBio: hostBio.trim() || undefined } : {}),
      });
      if (authProfile) {
        setProfile({
          ...authProfile,
          displayName: updated.displayName ?? displayName.trim(),
          bio: ((updated as { bio?: string | null }).bio ?? bio.trim()) || null,
          avatarUrl: data?.avatarUrl ?? authProfile.avatarUrl,
        });
      }
      toast.success('Profile saved');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader variant="profile" />;

  if (loadError || !data) {
    return (
      <SettingsPageShell narrow>
        <SettingsBackHeader
          title="Edit Profile"
          subtitle="Update how you appear on Lovenexa"
          icon={<User className="h-5 w-5 text-[#FF2E74]" />}
        />
        <div className="rounded-2xl border border-white/10 bg-[#17171C]/95 p-8 text-center">
          <p className="text-lg font-semibold text-white">Couldn&apos;t load your profile</p>
          <p className="mt-2 text-sm text-[#A7A7B3]">
            {loadError ?? 'We couldn\'t load your profile information.'}
          </p>
          <Button
            className="mt-5 cursor-pointer gradient-primary border-0"
            type="button"
            onClick={() => void load()}
          >
            Try Again
          </Button>
        </div>
      </SettingsPageShell>
    );
  }

  const aboutValue = data.isHost ? hostBio : bio;
  const setAbout = data.isHost ? setHostBio : setBio;

  return (
    <SettingsPageShell narrow>
      <SettingsBackHeader
        title="Edit Profile"
        subtitle="Update how you appear on Lovenexa"
        icon={<User className="h-5 w-5 text-[#FF2E74]" />}
      />

      <div className="space-y-6">
        {/* Photo */}
        <section className="rounded-2xl border border-white/10 bg-[#17171C]/95 p-5 sm:p-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#A7A7B3]">
            Profile photo
          </h2>
          <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full border-2 border-white/10 ring-2 ring-[#FF2E74]/20">
              {data.avatarUrl ? (
                <img
                  src={data.avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#FF2E74]/30 to-[#17171C] text-3xl font-bold text-white">
                  {firstName(displayName || data.displayName)[0] ?? '?'}
                </div>
              )}
            </div>
            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              <input
                ref={avatarInputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => void onAvatarChange(e)}
              />
              <Button
                type="button"
                className="cursor-pointer gradient-primary border-0"
                disabled={uploading}
                onClick={() => avatarInputRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
                Change photo
              </Button>
              {data.avatarUrl && (
                <Button
                  type="button"
                  variant="outline"
                  className="cursor-pointer border-white/12"
                  disabled={uploading}
                  onClick={() => void removeAvatar()}
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* Name + About */}
        <section className="space-y-4 rounded-2xl border border-white/10 bg-[#17171C]/95 p-5 sm:p-6">
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#A7A7B3]">
              Display name
            </label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
              className="mt-2 h-11 border-white/10 bg-white/5 text-white"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#A7A7B3]">
              About me
            </label>
            <textarea
              value={aboutValue}
              onChange={(e) => setAbout(e.target.value)}
              maxLength={500}
              rows={4}
              placeholder="Tell users a little about yourself..."
              className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/35 outline-none focus:border-[#FF6B9D]/50"
            />
            <p className="mt-1 text-right text-[11px] text-[#6B6B78]">
              {aboutValue.length}/500
            </p>
          </div>
          <Button
            type="button"
            className="h-11 w-full cursor-pointer border-0 gradient-primary sm:w-auto sm:min-w-[160px]"
            disabled={saving || uploading}
            onClick={() => void save()}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save changes
          </Button>
        </section>

        {/* Host gallery */}
        {data.isHost && (
          <section className="rounded-2xl border border-white/10 bg-[#17171C]/95 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#A7A7B3]">
                  My gallery
                </h2>
                <p className="mt-1 text-sm text-[#A7A7B3]">
                  Showcase photos on your public host profile
                </p>
              </div>
              <div>
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept={ACCEPT}
                  className="hidden"
                  onChange={(e) => void onGalleryAdd(e)}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="cursor-pointer border-white/12"
                  disabled={uploading || gallery.length >= 12}
                  onClick={() => galleryInputRef.current?.click()}
                >
                  <ImagePlus className="h-4 w-4" />
                  Add photo
                </Button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {gallery.map((img) => (
                <div
                  key={img.id}
                  className="group relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-black/20"
                >
                  <img
                    src={img.url}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => void removeGalleryImage(img.id)}
                    aria-label="Remove photo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {gallery.length === 0 && (
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className={cn(
                    'col-span-2 flex aspect-[2/1] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] text-sm text-[#A7A7B3] transition-colors hover:border-[#FF2E74]/40 hover:text-white sm:col-span-3 md:col-span-4',
                  )}
                >
                  <ImagePlus className="h-6 w-6" />
                  Add your first gallery photo
                </button>
              )}
            </div>
          </section>
        )}
      </div>
    </SettingsPageShell>
  );
}
