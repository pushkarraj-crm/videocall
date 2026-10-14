'use client';

import { useCallback, useEffect, useState } from 'react';
import { Route } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, type CallRoutingSettings } from '@/lib/api/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageLoader } from '@/components/shared/page-loader';

export default function CallRoutingSettingsPage() {
  const [settings, setSettings] = useState<CallRoutingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.getCallRoutingSettings();
      setSettings(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await adminApi.updateCallRoutingSettings({
        aiFallbackEnabled: settings.aiFallbackEnabled,
        realHostTimeoutSeconds: settings.realHostTimeoutSeconds,
        preferredRegion: settings.preferredRegion,
        preferredLanguage: settings.preferredLanguage,
        randomAiSelection: settings.randomAiSelection,
        defaultAiHostId: settings.defaultAiHostId,
        maxConcurrentAiSessions: settings.maxConcurrentAiSessions,
      });
      setSettings(updated);
      toast.success('Call routing settings saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) return <PageLoader variant="admin" />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Route className="h-7 w-7 text-[#FF2E74]" />
        <div>
          <h1 className="text-2xl font-bold text-white">Call Routing</h1>
          <p className="text-sm text-[#A7A7B3]">Real host first, AI host fallback</p>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-white/10 bg-black/30 p-5">
        <label className="flex items-center justify-between text-sm text-white">
          <span>AI Fallback</span>
          <input
            type="checkbox"
            checked={settings.aiFallbackEnabled}
            onChange={(e) => setSettings({ ...settings, aiFallbackEnabled: e.target.checked })}
          />
        </label>

        <div>
          <p className="mb-1 text-xs text-[#A7A7B3]">Real Host Timeout (seconds)</p>
          <Input
            type="number"
            min={3}
            max={120}
            value={settings.realHostTimeoutSeconds}
            onChange={(e) =>
              setSettings({ ...settings, realHostTimeoutSeconds: Number(e.target.value) })
            }
          />
        </div>

        <div>
          <p className="mb-1 text-xs text-[#A7A7B3]">Preferred Region</p>
          <Input
            value={settings.preferredRegion ?? ''}
            onChange={(e) => setSettings({ ...settings, preferredRegion: e.target.value || null })}
            placeholder="IN"
          />
        </div>

        <div>
          <p className="mb-1 text-xs text-[#A7A7B3]">Preferred Language</p>
          <Input
            value={settings.preferredLanguage ?? ''}
            onChange={(e) =>
              setSettings({ ...settings, preferredLanguage: e.target.value || null })
            }
            placeholder="en"
          />
        </div>

        <label className="flex items-center justify-between text-sm text-white">
          <span>Enable Random AI Selection</span>
          <input
            type="checkbox"
            checked={settings.randomAiSelection}
            onChange={(e) => setSettings({ ...settings, randomAiSelection: e.target.checked })}
          />
        </label>

        <div>
          <p className="mb-1 text-xs text-[#A7A7B3]">Default AI Host ID</p>
          <Input
            value={settings.defaultAiHostId ?? ''}
            onChange={(e) =>
              setSettings({ ...settings, defaultAiHostId: e.target.value || null })
            }
            placeholder="UUID (optional)"
          />
        </div>

        <div>
          <p className="mb-1 text-xs text-[#A7A7B3]">Maximum Concurrent AI Sessions</p>
          <Input
            type="number"
            min={1}
            max={500}
            value={settings.maxConcurrentAiSessions}
            onChange={(e) =>
              setSettings({ ...settings, maxConcurrentAiSessions: Number(e.target.value) })
            }
          />
        </div>

        <p className="text-xs text-[#A7A7B3]">
          Video catalog: {settings.videoCatalog.clips} clips across {settings.videoCatalog.hosts}{' '}
          pools
        </p>

        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}