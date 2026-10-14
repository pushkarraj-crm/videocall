import {
  AlertCircle,
  Bell,
  FileCheck,
  Gift,
  Heart,
  IndianRupee,
  Megaphone,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  Star,
  Tag,
  Wallet,
  XCircle,
} from 'lucide-react';
import type { NotificationType } from '@/types/notifications';

const ICON_MAP: Partial<Record<NotificationType, typeof Bell>> = {
  incoming_call: PhoneIncoming,
  missed_call: PhoneMissed,
  call_rejected: PhoneOff,
  call_cancelled: XCircle,
  call_ended: Phone,
  recharge_success: Wallet,
  recharge_failed: AlertCircle,
  withdrawal_requested: IndianRupee,
  withdrawal_approved: IndianRupee,
  withdrawal_rejected: IndianRupee,
  withdrawal_paid: IndianRupee,
  kyc_submitted: FileCheck,
  kyc_approved: FileCheck,
  kyc_rejected: FileCheck,
  referral_reward: Gift,
  friend_joined: Gift,
  coupon_available: Tag,
  coupon_expiring: Tag,
  festival_offer: Tag,
  bonus_coins: Wallet,
  new_follower: Heart,
  new_review: Star,
  rating_milestone: Star,
  admin_announcement: Megaphone,
  system_notice: Bell,
  maintenance_notice: AlertCircle,
  feature_release: Megaphone,
  security_alert: AlertCircle,
  password_changed: Bell,
  login_new_device: Bell,
};

const COLOR_MAP: Partial<Record<NotificationType, string>> = {
  incoming_call: 'bg-emerald-500/20 text-emerald-400',
  missed_call: 'bg-amber-500/20 text-amber-400',
  call_rejected: 'bg-red-500/20 text-red-400',
  call_cancelled: 'bg-zinc-500/20 text-zinc-400',
  call_ended: 'bg-zinc-500/20 text-zinc-400',
  recharge_success: 'bg-sky-500/20 text-sky-400',
  recharge_failed: 'bg-rose-500/20 text-rose-400',
  withdrawal_requested: 'bg-violet-500/20 text-violet-400',
  withdrawal_approved: 'bg-emerald-500/20 text-emerald-400',
  withdrawal_rejected: 'bg-rose-500/20 text-rose-400',
  withdrawal_paid: 'bg-emerald-500/20 text-emerald-400',
  kyc_submitted: 'bg-blue-500/20 text-blue-400',
  kyc_approved: 'bg-emerald-500/20 text-emerald-400',
  kyc_rejected: 'bg-red-500/20 text-red-400',
  referral_reward: 'bg-[#FF2E74]/20 text-[#FF6B9D]',
  friend_joined: 'bg-[#FF2E74]/20 text-[#FF6B9D]',
  coupon_available: 'bg-amber-500/20 text-amber-400',
  coupon_expiring: 'bg-amber-500/20 text-amber-400',
  festival_offer: 'bg-[#FF2E74]/20 text-[#FF6B9D]',
  bonus_coins: 'bg-sky-500/20 text-sky-400',
  new_follower: 'bg-pink-500/20 text-pink-400',
  new_review: 'bg-yellow-500/20 text-yellow-400',
  rating_milestone: 'bg-yellow-500/20 text-yellow-400',
  admin_announcement: 'bg-[#FF2E74]/20 text-[#FF6B9D]',
  system_notice: 'bg-indigo-500/20 text-indigo-400',
  maintenance_notice: 'bg-amber-500/20 text-amber-400',
  feature_release: 'bg-indigo-500/20 text-indigo-400',
  security_alert: 'bg-red-500/20 text-red-400',
  password_changed: 'bg-indigo-500/20 text-indigo-400',
  login_new_device: 'bg-indigo-500/20 text-indigo-400',
};

export function NotificationIcon({
  type,
  className = 'h-4 w-4',
}: {
  type: NotificationType;
  className?: string;
}) {
  const Icon = ICON_MAP[type] ?? Phone;
  return <Icon className={className} />;
}

export function notificationIconClass(type: NotificationType): string {
  return COLOR_MAP[type] ?? 'bg-white/10 text-white';
}