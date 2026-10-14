import { apiClient } from './client';
import { authApi } from '@/lib/api/auth';
import type { PublicHostRatingStats } from '@/lib/api/reviews';
import type { UserProfile } from '@/types/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1';

export interface PublicUserProfile {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  gender?: string | null;
  primaryLanguage?: string | null;
  communityWarningVisible?: boolean;
  hostProfile?: {
    isAvailable: boolean;
    isOnline?: boolean;
    isBusy?: boolean;
    status?: 'ONLINE' | 'OFFLINE' | 'BUSY';
    lastSeenAt?: string | null;
    lastSeenLabel?: string;
    canReceiveCalls?: boolean;
    hostBio?: string | null;
    languages: string[];
    totalCalls: number;
    ratingSum: number;
    ratingCount: number;
    rating?: number | null;
    virtualHostGallery?: string[];
  } | null;
  ratingStats?: PublicHostRatingStats | null;
  followStats?: {
    followerCount: number;
    isFollowing: boolean;
  } | null;
}

export interface EditableProfile {
  id: string;
  displayName: string;
  bio?: string | null;
  gender?: string | null;
  primaryLanguage?: string | null;
  avatarUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  isHost?: boolean;
  hostBio?: string | null;
  gallery?: Array<{ id: string; url: string; filename: string; uploadedAt: string }>;
  roles?: string[];
}

async function uploadFormFile<T>(path: string, file: File): Promise<T> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('platform_token') : null;
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  const json = (await res.json()) as { success?: boolean; data?: T; error?: { message?: string } };
  if (!res.ok || json.success === false) {
    throw new Error(json.error?.message ?? 'Upload failed');
  }
  return json.data as T;
}

function mapAuthMeToEditable(me: UserProfile & Record<string, unknown>): EditableProfile {
  const roles = (me.roles as string[] | undefined) ?? [];
  const isHost =
    typeof me.isHost === 'boolean'
      ? me.isHost
      : roles.includes('host');
  const gallery = Array.isArray(me.gallery)
    ? (me.gallery as EditableProfile['gallery'])
    : [];

  return {
    id: me.id,
    displayName: me.displayName,
    bio: me.bio ?? null,
    gender: me.gender ?? null,
    primaryLanguage: me.primaryLanguage ?? null,
    avatarUrl: me.avatarUrl ?? null,
    phone: me.phone ?? null,
    email: me.email ?? null,
    isHost,
    hostBio: (me.hostBio as string | null | undefined) ?? null,
    gallery: gallery ?? [],
    roles,
  };
}

export const usersApi = {
  getPublicProfile: (id: string) => apiClient<PublicUserProfile>(`/users/${id}`),

  /**
   * Load editable profile for the authenticated account (User or Host).
   * Primary: GET /auth/me (stable, used app-wide).
   * Secondary: GET /users/me (same data; used if auth shape is incomplete).
   */
  getEditableProfile: async (): Promise<EditableProfile> => {
    try {
      const me = await authApi.getMe();
      const mapped = mapAuthMeToEditable(me as UserProfile & Record<string, unknown>);
      // Prefer dedicated users/me when it succeeds (ensures gallery/hostBio present)
      try {
        const dedicated = await apiClient<EditableProfile>('/users/me');
        if (dedicated?.id) {
          return {
            ...mapped,
            ...dedicated,
            isHost: dedicated.isHost ?? mapped.isHost,
            gallery: dedicated.gallery ?? mapped.gallery ?? [],
            hostBio: dedicated.hostBio ?? mapped.hostBio ?? null,
          };
        }
      } catch {
        /* auth/me is enough for core fields */
      }
      return mapped;
    } catch (primaryErr) {
      // Last resort: dedicated endpoint alone
      try {
        return await apiClient<EditableProfile>('/users/me');
      } catch {
        throw primaryErr;
      }
    }
  },

  updateMe: (
    data: Partial<
      Pick<UserProfile, 'displayName' | 'bio' | 'gender' | 'primaryLanguage' | 'avatarUrl'> & {
        hostBio?: string;
      }
    >,
  ) => apiClient<UserProfile>('/users/me', { method: 'PATCH', body: JSON.stringify(data) }),

  getConsents: () => apiClient<unknown[]>('/users/me/consents'),

  uploadAvatar: (file: File) =>
    uploadFormFile<{ avatarUrl: string }>('/users/me/avatar', file),

  clearAvatar: () =>
    apiClient<{ avatarUrl: null }>('/users/me/avatar', { method: 'DELETE' }),

  uploadGallery: (file: File) =>
    uploadFormFile<{
      image: { id: string; url: string; filename: string; uploadedAt: string };
      gallery: Array<{ id: string; url: string; filename: string; uploadedAt: string }>;
    }>('/users/me/gallery', file),

  removeGalleryImage: (imageId: string) =>
    apiClient<{ removed: boolean; gallery: Array<{ id: string; url: string }> }>(
      `/users/me/gallery/${encodeURIComponent(imageId)}`,
      { method: 'DELETE' },
    ),
};
