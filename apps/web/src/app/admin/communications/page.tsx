'use client';

import { useEffect, useState } from 'react';
import { Mail, MessageSquare, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import {
  communicationsApi,
  type CommunicationAudience,
} from '@/lib/api/communications';

const AUDIENCES: { value: CommunicationAudience; label: string }[] = [
  { value: 'all_users', label: 'All Users' },
  { value: 'hosts', label: 'Hosts' },
  { value: 'users', label: 'Users' },
  { value: 'verified_hosts', label: 'Verified Hosts' },
  { value: 'vip_users', label: 'VIP Users' },
  { value: 'single_user', label: 'Single User' },
];

export default function AdminCommunicationsPage() {
  const [tab, setTab] = useState<'email' | 'sms'>('email');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<CommunicationAudience>('all_users');
  const [targetUserId, setTargetUserId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [sending, setSending] = useState(false);
  const [analytics, setAnalytics] = useState<{
    totalEmails: number;
    deliveryRate: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
    smsDeliveryRate: number;
    totalSms: number;
  } | null>(null);
  const [campaigns, setCampaigns] = useState<
    Array<{ id: string; channel: string; title: string; status: string; recipientCount: number }>
  >([]);
  const [logs, setLogs] = useState<
    Array<{ id: string; channel: string; recipient: string; status: string; eventType: string }>
  >([]);

  const refresh = async () => {
    const [a, list, logRes] = await Promise.all([
      communicationsApi.adminAnalytics(),
      communicationsApi.adminList(),
      communicationsApi.adminLogs({ limit: 10 }),
    ]);
    setAnalytics(a);
    setCampaigns(list.items);
    setLogs(logRes.items);
  };

  useEffect(() => {
    void refresh().catch(() => {});
  }, []);

  const handleSend = async (draft = false, preview = false) => {
    if (!title.trim() || !body.trim()) {
      toast.error('Title and body are required');
      return;
    }
    if (tab === 'email' && !subject.trim()) {
      toast.error('Subject is required for email');
      return;
    }
    if (audience === 'single_user' && !targetUserId.trim()) {
      toast.error('User ID required for single user audience');
      return;
    }

    setSending(true);
    try {
      const payload = {
        title: title.trim(),
        body: body.trim(),
        audience,
        targetUserId: audience === 'single_user' ? targetUserId.trim() : undefined,
        scheduledAt: scheduledAt || undefined,
        draft,
        preview,
      };

      const result =
        tab === 'email'
          ? await communicationsApi.sendEmail({
              ...payload,
              subject: subject.trim(),
            })
          : await communicationsApi.sendSms(payload);

      if (preview) {
        toast.success('Preview generated');
      } else {
        toast.success(draft ? 'Draft saved' : `Status: ${(result as { status?: string }).status ?? 'SENT'}`);
        if (!draft) {
          setTitle('');
          setSubject('');
          setBody('');
          setScheduledAt('');
        }
      }
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="premium-glow-bg mx-auto max-w-4xl space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FF2E74]/15">
          <Mail className="h-5 w-5 text-[#FF6B9D]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Communications</h1>
          <p className="text-sm text-muted-foreground">Email & SMS campaigns</p>
        </div>
      </div>

      {analytics ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Total Emails', value: analytics.totalEmails },
            { label: 'Delivery Rate', value: `${analytics.deliveryRate}%` },
            { label: 'Open Rate', value: `${analytics.openRate}%` },
            { label: 'Click Rate', value: `${analytics.clickRate}%` },
            { label: 'SMS Delivery', value: `${analytics.smsDeliveryRate}%` },
          ].map((s) => (
            <Card key={s.label} className="border-white/8 bg-[#17171C]/90">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <Card className="border-white/8 bg-[#17171C]/90">
        <CardHeader>
          <div className="flex gap-2">
            <Button
              variant={tab === 'email' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab('email')}
            >
              <Mail className="mr-1 h-4 w-4" /> Email
            </Button>
            <Button
              variant={tab === 'sms' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab('sms')}
            >
              <MessageSquare className="mr-1 h-4 w-4" /> SMS
            </Button>
          </div>
          <CardTitle className="text-lg">Compose {tab === 'email' ? 'Email' : 'SMS'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Campaign title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Internal name" />
          </div>
          {tab === 'email' ? (
            <div>
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject" />
            </div>
          ) : null}
          <div>
            <Label>{tab === 'email' ? 'Body (plain text)' : 'SMS message'}</Label>
            <textarea
              className="mt-1 flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              maxLength={tab === 'sms' ? 500 : undefined}
              placeholder={tab === 'sms' ? 'Max 500 chars, Unicode supported' : 'Message body'}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Audience</Label>
              <select
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={audience}
                onChange={(e) => setAudience(e.target.value as CommunicationAudience)}
              >
                {AUDIENCES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Schedule (optional)</Label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
          </div>
          {audience === 'single_user' ? (
            <div>
              <Label>Target user ID</Label>
              <Input value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} />
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button disabled={sending} onClick={() => void handleSend(false)}>
              <Send className="mr-2 h-4 w-4" /> Send Now
            </Button>
            <Button variant="outline" disabled={sending} onClick={() => void handleSend(true)}>
              Save Draft
            </Button>
            <Button variant="ghost" disabled={sending} onClick={() => void handleSend(false, true)}>
              Preview
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/8 bg-[#17171C]/90">
        <CardHeader>
          <CardTitle className="text-lg">Recent Campaigns</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No campaigns yet</p>
          ) : (
            campaigns.slice(0, 8).map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-white/8 p-3 text-sm">
                <div>
                  <p className="font-medium">{c.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.channel.toUpperCase()} · {c.status} · {c.recipientCount} recipients
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-white/8 bg-[#17171C]/90">
        <CardHeader>
          <CardTitle className="text-lg">Delivery Logs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No logs yet</p>
          ) : (
            logs.map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-lg border border-white/8 p-3 text-sm">
                <div>
                  <p className="font-medium">{l.eventType}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.channel.toUpperCase()} → {l.recipient}
                  </p>
                </div>
                <span className="text-xs font-medium text-[#FF6B9D]">{l.status}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}