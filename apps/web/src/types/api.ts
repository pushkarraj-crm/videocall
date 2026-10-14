export interface ApiResponse<T> {
  success: boolean;
  data: T;
  requestId?: string;
}

export interface ApiError {
  success: false;
  error: {
    message: string;
    code?: string;
    statusCode: number;
  };
  requestId?: string;
}

export type Role =
  | 'user'
  | 'host'
  | 'moderator'
  | 'admin'
  | 'super_admin'
  | 'grievance_officer'
  | 'support';

export interface AuthUser {
  id: string;
  displayName: string;
  status: string;
  roles: Role[];
  needsOnboarding?: boolean;
}

export interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: string;
  user: AuthUser;
  isNewUser?: boolean;
}

export interface WalletSummary {
  balanceUnits: string;
  balanceCoins: number;
  lockedUnits: string;
  freeCallsUsed: number;
  freeCallsRemaining: number;
}

export interface UserProfile {
  id: string;
  displayName: string;
  phone?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  gender?: string | null;
  primaryLanguage?: string | null;
  referralCode?: string;
  status?: string;
  freeCallsUsed?: number;
  lastLoginAt?: string | null;
  walletCoins?: number;
  roles?: Role[];
  wallet?: WalletSummary;
  hostProfile?: {
    isAvailable: boolean;
    hostBio?: string | null;
    languages: string[];
    totalCalls: number;
    ratingSum: number;
    ratingCount: number;
  } | null;
}

export type HostProfileType = 'REAL_HOST' | 'MANAGED_HOST' | 'AI_HOST';

export interface VirtualHostMeta {
  profileType: HostProfileType;
  isVirtualHost: boolean;
  displayName: string;
  greeting: string;
  avatar: {
    imageUrl?: string | null;
    idleAnimation?: string;
    talkAnimation?: string;
    smileAnimation?: string;
    giftReactionAnimation?: string;
    callEndAnimation?: string;
    typingAnimation?: string;
    defaultIdleAnimation?: string;
    expressionIntensity?: number;
    blinkFrequency?: 'low' | 'medium' | 'high';
    headMovement?: 'subtle' | 'normal' | 'expressive';
    reactionsEnabled?: boolean;
    lipSyncIntensity?: number;
    idleSchedulerEnabled?: boolean;
    minAnimationCooldownMs?: number;
  };
  personality?: Record<string, unknown>;
  voice?: Record<string, unknown>;
  video?: {
    enabled?: boolean;
    renderMode?: 'cinematic' | 'video';
    cameraMode?: 'close' | 'medium' | 'portrait' | 'auto';
    autoZoom?: boolean;
    dynamicFraming?: boolean;
    lipSyncMode?: 'phoneme' | 'energy';
    idleDrift?: boolean;
    eyeTracking?: boolean;
    clips?: Record<string, string>;
    assetSlug?: string;
    sceneSlug?: string;
  };
  wardrobe?: {
    activeOutfitId?: string;
    outfits?: Array<{
      id: string;
      name: string;
      category: string;
      imageUrl?: string;
      videoIdleUrl?: string;
      videoTalkUrl?: string;
      approved?: boolean;
    }>;
  };
  activeOutfit?: {
    id: string;
    name: string;
    category: string;
    imageUrl?: string;
    videoIdleUrl?: string;
    videoTalkUrl?: string;
    approved?: boolean;
  } | null;
  language?: string;
}

export interface HostDiscoverItem {
  userId: string;
  isAvailable: boolean;
  isOnline?: boolean;
  isBusy?: boolean;
  status?: 'ONLINE' | 'OFFLINE' | 'BUSY';
  lastSeenAt?: string | null;
  lastSeenLabel?: string;
  canReceiveCalls?: boolean;
  totalCalls?: number;
  rating?: number | null;
  reviewCount?: number;
  followerCount?: number;
  isFollowing?: boolean;
  isVerified?: boolean;
  profileType?: HostProfileType;
  virtualHostRegion?: string | null;
  virtualHostLanguage?: string | null;
  virtualHostPriority?: number;
  virtualHostPopularity?: number;
  virtualHostGallery?: string[];
  age?: number | null;
  coinsPerMinute?: number;
  isAiHost?: boolean;
  user: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    bio?: string | null;
    gender?: string | null;
    primaryLanguage?: string | null;
  };
}

export interface CallInitiateResponse {
  callId: string;
  roomId: string;
  zego: { token: string; appId: string; roomId: string; userId?: string; expireSeconds?: number };
  isFreeCall: boolean;
  isVirtualHost?: boolean;
  profileType?: HostProfileType;
  virtualHost?: VirtualHostMeta;
  virtualSessionId?: string;
  hostCallType?: 'REAL_HOST' | 'AI_HOST';
  routing?: 'REAL_HOST' | 'AI_HOST';
  aiFallback?: boolean;
  lockedVideoUrl?: string | null;
  matchedHostId?: string;
  coinsPerMinute?: number;
}

export interface CoinPackage {
  id: string;
  name: string;
  priceInr: string;
  coinUnits: string;
  bonusUnits: string;
}