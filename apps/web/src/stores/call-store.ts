'use client';

import { create } from 'zustand';
import type { CallInitiateResponse, VirtualHostMeta } from '@/types/api';

interface ActiveCall {
  callId: string;
  roomId: string;
  zego: CallInitiateResponse['zego'];
  isFreeCall: boolean;
  calleeId?: string;
  callerId?: string;
  role: 'caller' | 'callee';
  startedAt?: number;
  coinsPerMinute: number;
  isVirtualHost?: boolean;
  virtualHost?: VirtualHostMeta;
  lockedVideoUrl?: string | null;
  hostCallType?: 'REAL_HOST' | 'AI_HOST';
  consented?: boolean;
}

interface CallState {
  activeCall: ActiveCall | null;
  incomingCall: { callId: string; callerName: string; callerId: string } | null;
  acceptingCallId: string | null;
  setActiveCall: (call: ActiveCall | null) => void;
  setIncomingCall: (call: CallState['incomingCall']) => void;
  setAcceptingCallId: (callId: string | null) => void;
}

export const useCallStore = create<CallState>((set) => ({
  activeCall: null,
  incomingCall: null,
  acceptingCallId: null,
  setActiveCall: (activeCall) => set({ activeCall }),
  setIncomingCall: (incomingCall) => set({ incomingCall }),
  setAcceptingCallId: (acceptingCallId) => set({ acceptingCallId }),
}));