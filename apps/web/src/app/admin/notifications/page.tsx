'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Megaphone, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { notificationsApi } from '@/lib/api/notifications';
import type { AnnouncementTarget, NotificationPriority } from '@/types/notifications';

const TARGETS: { value: AnnouncementTarget; label: string }[] = [
  { value: 'all_users', label: 'All Users' },
  { value: 'hosts_only', label: 'Only Hosts' },
  { value: 'users_only', label: 'Only Users' },
  { value: 'verified_hosts', label: 'Verified Hosts' },
  { value: 'premium_users', label: 'Premium Users' },
  { value: 'single_user', label: 'Single User' },
];

const PRIORITIES: { value: NotificationPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export default function AdminNotificationsPage() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState<AnnouncementTarget>('all_users');
  const [priority, setPriority] = useState<NotificationPriority>('normal');
  const [userId, setUserId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [sending, setSending] = useState(false);
  const [analytics, setAnalytics] = useState<{
    notificationsSent: number;
    read: number;
    clicked: number;
    ctr: number;
    unreadPercent: number;
  } | null>(null);
  const [broadcasts, setBroadcasts] = useState<
    Array<{ id: string; title: string; status: string; recipientCount: number }>
  >([]);

  useEffect(() => {
    void notificationsApi.adminAnalytics().then(setAnalytics).catch(() => {});
    void notificationsApi.adminList().then((r) => setBroadcasts(r.items)).catch(() => {});
  }, []);

  const handleSend = async (draft = false) => {
    if (!title.trim() || !message.trim()) {
      toast.error('Title and message are required');
      return;
    }
    if (target === 'single_user' && !userId.trim()) {
      toast.error('User ID is required for single-user announcements');
      return;
    }

    setSending(true);
    try {
      const result = await notificationsApi.createBroadcast({
        title: title.trim(),
        message: message.trim(),
        target,
        priority,
        userId: target === 'single_user' ? userId.trim() : undefined,
        scheduledAt: scheduledAt || undefined,
        draft,
      });
      toast.success(draft ? 'Draft saved' : `Broadcast status: ${(result as { status?: string }).status ?? 'SENT'}`);
      if (!draft) {
        setTitle('');
        setMessage('');
        setScheduledAt('');
      }
      const [a, list] = await Promise.all([
        notificationsApi.adminAnalytics(),
        notificationsApi.adminList(),
      ]);
      setAnalytics(a);
      setBroadcasts(list.items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="premium-glow-bg mx-auto max-w-3xl space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FF2E74]/15">
          <Megaphone className="h-5 w-5 text-[#FF6B9D]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground">Broadcast & analytics</p>
        </div>
      </div>

      {analytics && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="premium-card border-white/8 bg-[#17171C]/90 p-4">
            <p className="text-2xl font-bold">{analytics.notificationsSent}</p>
            <p className="text-xs text-muted-foreground">Sent</p>
          </div>
          <div className="premium-card border-white/8 bg-[#17171C]/90 p-4">
            <p className="text-2xl font-bold">{analytics.read}</p>
            <p className="text-xs text-muted-foreground">Read</p>
          </div>
          <div className="premium-card border-white/8 bg-[#17171C]/90 p-4">
            <p className="text-2xl font-bold">{analytics.ctr}%</p>
            <p className="text-xs text-muted-foreground">CTR</p>
          </div>
          <div className="premium-card border-white/8 bg-[#17171C]/90 p-4">
            <p className="text-2xl font-bold">{analytics.unreadPercent}%</p>
            <p className="text-xs text-muted-foreground">Unread</p>
          </div>
        </div>
      )}

      <Card className="premium-card border-white/8 bg-[#17171C]/90">
        <CardHeader>
          <CardTitle className="text-lg">Create Announcement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={2000}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {TARGETS.map((t) => (
              <Button
                key={t.value}
                type="button"
                variant={target === t.value ? 'default' : 'outline'}
                className={target === t.value ? 'gradient-primary' : ''}
                onClick={() => setTarget(t.value)}
              >
                {t.label}
              </Button>
            ))}
          </div>
          {target === 'single_user' && (
            <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="User UUID" />
          )}
          <div className="flex flex-wrap gap-2">
            {PRIORITIES.map((p) => (
              <Button
                key={p.value}
                size="sm"
                variant={priority === p.value ? 'default' : 'outline'}
                onClick={() => setPriority(p.value)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <Input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            placeholder="Schedule (optional)"
          />
          <div className="flex gap-2">
            <Button className="flex-1 gradient-primary" disabled={sending} onClick={() => void handleSend(false)}>
              <Send className="mr-2 h-4 w-4" />
              Send Now
            </Button>
            <Button variant="outline" disabled={sending} onClick={() => void handleSend(true)}>
              Save Draft
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                void notificationsApi
                  .createBroadcast({ title, message, target, preview: true })
                  .then(() => toast.success('Preview ready'))
              }
            >
              Preview
            </Button>
          </div>
        </CardContent>
      </Card>

      {broadcasts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Recent broadcasts</h2>
          {broadcasts.slice(0, 8).map((b) => (
            <div key={b.id} className="premium-card border-white/8 bg-[#17171C]/90 p-3 text-sm">
              <p className="font-medium">{b.title}</p>
              <p className="text-xs text-muted-foreground">
                {b.status} · {b.recipientCount} recipients
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}