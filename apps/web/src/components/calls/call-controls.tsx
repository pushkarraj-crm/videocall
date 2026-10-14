'use client';

import { Mic, MicOff, PhoneOff, Video, VideoOff, SwitchCamera, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CallControlsProps {
  muted: boolean;
  cameraOff: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onEndCall: () => void;
  className?: string;
}

export function CallControls({
  muted,
  cameraOff,
  onToggleMute,
  onToggleCamera,
  onEndCall,
  className,
}: CallControlsProps) {
  return (
    <div
      className={cn(
        'premium-glass flex items-center justify-center gap-3 rounded-[28px] px-5 py-3',
        className,
      )}
    >
      <ControlButton
        active={muted}
        onClick={onToggleMute}
        label={muted ? 'Unmute' : 'Mute'}
        icon={muted ? MicOff : Mic}
      />
      <ControlButton
        active={cameraOff}
        onClick={onToggleCamera}
        label={cameraOff ? 'Camera on' : 'Camera off'}
        icon={cameraOff ? VideoOff : Video}
      />
      <button
        type="button"
        className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/50 transition-colors"
        aria-label="Flip camera"
        disabled
      >
        <SwitchCamera className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={onEndCall}
        aria-label="End call"
        className="press-scale flex h-14 w-14 items-center justify-center rounded-full bg-[#FF2E74] text-white shadow-[0_4px_24px_rgba(255,46,116,0.5)] transition-transform hover:scale-105"
      >
        <PhoneOff className="h-6 w-6" />
      </button>
    </div>
  );
}

function ControlButton({
  active,
  onClick,
  label,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: LucideIcon;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'press-scale flex h-12 w-12 items-center justify-center rounded-full border transition-all duration-200',
        active
          ? 'border-[#FF2E74]/40 bg-[#FF2E74]/20 text-[#FF2E74]'
          : 'border-white/10 bg-white/5 text-white hover:bg-white/10',
      )}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}