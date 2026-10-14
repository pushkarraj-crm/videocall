'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthSession, UserProfile } from '@/types/api';
import { clearAuthToken, setAuthToken } from '@/lib/api/client';
import { authApi } from '@/lib/api/auth';
import { useCallStore } from '@/stores/call-store';

interface AuthState {
  session: AuthSession | null;
  profile: UserProfile | null;
  isLoading: boolean;
  hasHydrated: boolean;
  setSession: (session: AuthSession) => void;
  setProfile: (profile: UserProfile) => void;
  setHasHydrated: () => void;
  refreshProfile: () => Promise<void>;
  logout: () => void;
  isHost: () => boolean;
  isAdmin: () => boolean;
}

let profileRequest: { token: string; promise: Promise<void> } | null = null;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      profile: null,
      isLoading: false,
      hasHydrated: false,

      setSession: (session) => {
        setAuthToken(session.accessToken);
        set({ session, ...(get().session?.user.id !== session.user.id ? { profile: null } : {}) });
      },

      setProfile: (profile) => set({ profile }),

      setHasHydrated: () => set({ hasHydrated: true }),

      refreshProfile: () => {
        const tokenAtStart = get().session?.accessToken;
        if (!tokenAtStart) return Promise.resolve();
        if (profileRequest?.token === tokenAtStart) return profileRequest.promise;
        set({ isLoading: true });
        const promise = authApi.getMe().then((profile) => {
          if (get().session?.accessToken === tokenAtStart) set({ profile });
        }).finally(() => {
          if (profileRequest?.promise === promise) {
            profileRequest = null;
            if (get().session?.accessToken === tokenAtStart) set({ isLoading: false });
          }
        });
        profileRequest = { token: tokenAtStart, promise };
        return promise;
      },

      logout: () => {
        profileRequest = null;
        const refreshToken = get().session?.refreshToken;
        if (refreshToken) {
          void authApi.logout(refreshToken).catch(() => undefined);
        }
        clearAuthToken();
        useCallStore.getState().setActiveCall(null);
        useCallStore.getState().setIncomingCall(null);
        useCallStore.getState().setAcceptingCallId(null);
        set({ session: null, profile: null, isLoading: false });
      },

      isHost: () => {
        const state = get();
        if (state.profile?.roles) return state.profile.roles.includes('host');
        return state.session?.user?.roles?.includes('host') ?? false;
      },

      isAdmin: () => {
        const roles = get().profile?.roles ?? get().session?.user?.roles ?? [];
        return roles.some((r) =>
          ['admin', 'super_admin', 'moderator', 'grievance_officer', 'support'].includes(r),
        );
      },
    }),
    {
      name: 'platform-auth',
      partialize: (state) => ({ session: state.session }),
      onRehydrateStorage: () => (state) => {
        if (state?.session?.accessToken) {
          setAuthToken(state.session.accessToken);
        }
        useAuthStore.setState({ hasHydrated: true });
      },
    },
  ),
);
