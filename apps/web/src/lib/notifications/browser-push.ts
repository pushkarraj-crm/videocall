import type { AppNotification, NotificationType } from '@/types/notifications';

const BROWSER_PUSH_TYPES = new Set<NotificationType>([
  'incoming_call',
  'missed_call',
  'recharge_success',
  'withdrawal_approved',
  'kyc_approved',
  'referral_reward',
  'festival_offer',
  'admin_announcement',
]);

const SETTINGS_KEY = 'platform_notification_settings_cache';

function browserPushEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return true;
    const parsed = JSON.parse(raw) as { browserPush?: boolean };
    return parsed.browserPush !== false;
  } catch {
    return true;
  }
}

export function cacheNotificationSettings(settings: { browserPush: boolean }) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

const PERMISSION_KEY = 'platform_notification_permission_asked';

export function supportsBrowserPush(type: NotificationType): boolean {
  return BROWSER_PUSH_TYPES.has(type);
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  if (localStorage.getItem(PERMISSION_KEY)) {
    return Notification.permission;
  }
  localStorage.setItem(PERMISSION_KEY, '1');
  return Notification.requestPermission();
}

export function showBrowserNotification(notification: AppNotification) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (!browserPushEnabled()) return;
  if (!supportsBrowserPush(notification.type)) return;

  const n = new Notification(notification.title, {
    body: notification.message,
    tag: notification.id,
    icon: notification.image ?? '/favicon.ico',
    silent: notification.type !== 'incoming_call',
  });

  n.onclick = () => {
    window.focus();
    if (notification.actionRoute) {
      window.location.href = notification.actionRoute;
    }
    n.close();
  };
}