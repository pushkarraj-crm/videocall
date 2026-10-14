'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { toast } from 'sonner';
import { PageLoader } from '@/components/shared/page-loader';
import { SettingsGroup, SettingsRow } from '@/components/shared/settings-row';
import { SettingsPageShell } from '@/components/settings/settings-page-shell';
import { SettingsBackHeader } from '@/components/settings/settings-back-header';
import { notificationsApi, type NotificationSettings } from '@/lib/api/notifications';
import { requestNotificationPermission } from '@/lib/notifications/browser-push';

type SettingKey = keyof NotificationSettings;

const TOGGLES: Array<{ key: SettingKey; label: string; description: string }> = [
  { key: 'incomingCalls', label: 'Incoming calls', description: 'Ring and alert for live calls' },
  { key: 'recharge', label: 'Recharge', description: 'Wallet top-up success and failures' },
  { key: 'referral', label: 'Referral', description: 'Rewards and friends who joined' },
  { key: 'promotions', label: 'Promotions', description: 'Coupons, offers, and festival deals' },
  { key: 'withdrawals', label: 'Withdrawals', description: 'Payout request updates' },
  { key: 'reviews', label: 'Reviews', description: 'New ratings and milestones' },
  { key: 'announcements', label: 'Announcements', description: 'App news and security alerts' },
  { key: 'browserPush', label: 'Browser notifications', description: 'Native OS notifications' },
  { key: 'sound', label: 'Sound', description: 'Play sound for urgent alerts' },
  { key: 'vibration', label: 'Vibration', description: 'Reserved for mobile apps' },
];

export default function NotificationSettingsPage() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    notificationsApi
      .getSettings()
      .then(setSettings)
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const update = async (key: SettingKey, value: boolean) => {
    if (!settings) return;
    const next = { ...settings, [key]: value };
    setSettings(next);
    try {
      if (key === 'browserPush' && value) {
        await requestNotificationPermission();
      }
      await notificationsApi.updateSettings({ [key]: value });
    } catch (e) {
      setSettings(settings);
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  };

  if (loading || !settings) return <PageLoader variant="list" />;

  return (
    <SettingsPageShell narrow>
      <SettingsBackHeader
        title="Notification Settings"
        subtitle="Control what you receive"
        icon={<Bell className="h-5 w-5 text-[#FF2E74]" />}
      />

      <SettingsGroup title="Alerts">
        {TOGGLES.map((t) => (
          <SettingsRow
            key={t.key}
            label={t.label}
            description={t.description}
            switchChecked={settings[t.key]}
            onSwitchChange={(v) => void update(t.key, v)}
          />
        ))}
      </SettingsGroup>
    </SettingsPageShell>
  );
}
