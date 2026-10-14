'use client';

import { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import { toast } from 'sonner';
import { PageLoader } from '@/components/shared/page-loader';
import { SettingsGroup, SettingsRow } from '@/components/shared/settings-row';
import { SettingsPageShell } from '@/components/settings/settings-page-shell';
import { SettingsBackHeader } from '@/components/settings/settings-back-header';
import { communicationsApi, type CommunicationSettings } from '@/lib/api/communications';

type SettingKey = keyof CommunicationSettings;

const TOGGLES: Array<{
  key: SettingKey;
  label: string;
  description: string;
  mandatory?: boolean;
}> = [
  { key: 'marketingEmails', label: 'Marketing emails', description: 'Welcome messages and onboarding tips' },
  { key: 'marketingSms', label: 'Marketing SMS', description: 'Promotional SMS campaigns' },
  { key: 'transactionalEmails', label: 'Transactional emails', description: 'Recharges, receipts, and account updates' },
  { key: 'transactionalSms', label: 'Transactional SMS', description: 'Recharge and withdrawal SMS alerts' },
  { key: 'securityEmails', label: 'Security emails', description: 'Password reset and login alerts', mandatory: true },
  { key: 'securitySms', label: 'Security SMS', description: 'OTP and security alerts', mandatory: true },
  { key: 'promotionEmails', label: 'Promotion emails', description: 'Coupons, offers, and festival deals' },
  { key: 'promotionSms', label: 'Promotion SMS', description: 'Offer and campaign SMS' },
  { key: 'referralUpdates', label: 'Referral updates', description: 'Rewards and friends who joined' },
];

export default function CommunicationSettingsPage() {
  const [settings, setSettings] = useState<CommunicationSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    communicationsApi
      .getSettings()
      .then(setSettings)
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const update = async (key: SettingKey, value: boolean) => {
    if (!settings || TOGGLES.find((t) => t.key === key)?.mandatory) return;
    const next = { ...settings, [key]: value };
    setSettings(next);
    try {
      await communicationsApi.updateSettings({ [key]: value });
    } catch (e) {
      setSettings(settings);
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  };

  if (loading || !settings) return <PageLoader variant="list" />;

  return (
    <SettingsPageShell narrow>
      <SettingsBackHeader
        title="Email & SMS"
        subtitle="Communication preferences"
        icon={<Mail className="h-5 w-5 text-[#FF2E74]" />}
      />

      <SettingsGroup title="Channels">
        {TOGGLES.map((t) => (
          <SettingsRow
            key={t.key}
            label={t.mandatory ? `${t.label} (required)` : t.label}
            description={t.description}
            switchChecked={settings[t.key]}
            switchDisabled={t.mandatory}
            onSwitchChange={(v) => void update(t.key, v)}
          />
        ))}
      </SettingsGroup>
    </SettingsPageShell>
  );
}
