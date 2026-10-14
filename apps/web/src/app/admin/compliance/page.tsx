'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FileText, History, RefreshCw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/shared/page-loader';
import { legalApi, type LegalPolicyDetail, type LegalPolicyRevision } from '@/lib/api/legal';
import { cn } from '@/lib/utils';

const SLUG_LABELS: Record<string, string> = {
  privacy: 'Privacy Policy',
  terms: 'Terms & Conditions',
  'refund-policy': 'Refund Policy',
  'community-guidelines': 'Community Guidelines',
  'content-policy': 'Content Moderation',
  'age-policy': 'Age Verification',
};

export default function AdminCompliancePage() {
  const [policies, setPolicies] = useState<LegalPolicyDetail[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [history, setHistory] = useState<LegalPolicyRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewingRevision, setViewingRevision] = useState<string | null>(null);

  const selected = policies.find((p) => p.slug === selectedSlug) ?? null;

  const loadPolicies = useCallback(async () => {
    const data = await legalApi.listAdmin();
    setPolicies(data.items);
    if (!selectedSlug && data.items.length > 0) {
      setSelectedSlug(data.items[0].slug);
    }
  }, [selectedSlug]);

  const loadHistory = useCallback(async (slug: string) => {
    const data = await legalApi.getHistory(slug);
    setHistory(data.items);
  }, []);

  useEffect(() => {
    loadPolicies()
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load policies'))
      .finally(() => setLoading(false));
  }, [loadPolicies]);

  useEffect(() => {
    if (!selected) return;
    setTitle(selected.title);
    setContent(selected.content);
    setViewingRevision(null);
    loadHistory(selected.slug).catch(() => setHistory([]));
  }, [selected, loadHistory]);

  const saveDraft = async () => {
    if (!selectedSlug) return;
    setSaving(true);
    try {
      const updated = await legalApi.updatePolicy(selectedSlug, {
        title,
        content,
        publish: false,
      });
      setPolicies((prev) => prev.map((p) => (p.slug === updated.slug ? updated : p)));
      toast.success('Draft saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!selectedSlug) return;
    setSaving(true);
    try {
      const updated = await legalApi.updatePolicy(selectedSlug, {
        title,
        content,
        publish: true,
      });
      setPolicies((prev) => prev.map((p) => (p.slug === updated.slug ? updated : p)));
      await loadHistory(selectedSlug);
      toast.success(`Published version ${updated.version}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Publish failed');
    } finally {
      setSaving(false);
    }
  };

  const openRevision = async (revisionId: string) => {
    if (!selectedSlug) return;
    try {
      const revision = await legalApi.getRevision(selectedSlug, revisionId);
      setTitle(revision.title);
      setContent(revision.content);
      setViewingRevision(revisionId);
      toast.message(`Viewing version ${revision.version}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load revision');
    }
  };

  if (loading) return <PageLoader label="Loading compliance policies" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Compliance</h1>
          <p className="mt-1 text-sm text-[#A7A7B3]">
            View, edit, and publish legal policies with version history.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => loadPolicies()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-2 rounded-2xl border border-white/10 bg-[#17171C] p-3">
          {policies.map((policy) => (
            <button
              key={policy.slug}
              type="button"
              onClick={() => setSelectedSlug(policy.slug)}
              className={cn(
                'flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors',
                selectedSlug === policy.slug
                  ? 'bg-[#FF2E74]/15 text-white'
                  : 'text-[#A7A7B3] hover:bg-white/5 hover:text-white',
              )}
            >
              <FileText className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="text-sm font-medium">{SLUG_LABELS[policy.slug] ?? policy.title}</p>
                <p className="text-xs text-white/45">v{policy.version}</p>
              </div>
            </button>
          ))}
        </aside>

        <div className="space-y-4">
          {selected ? (
            <>
              <div className="rounded-2xl border border-white/10 bg-[#17171C] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white">{selected.title}</h2>
                    <p className="text-xs text-[#A7A7B3]">
                      Published {new Date(selected.publishedAt).toLocaleString()} · Updated{' '}
                      {new Date(selected.lastUpdated).toLocaleString()}
                      {viewingRevision ? ' · viewing historical revision' : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={saving} onClick={saveDraft}>
                      <Save className="mr-2 h-4 w-4" />
                      Save draft
                    </Button>
                    <Button variant="gradient" size="sm" disabled={saving} onClick={publish}>
                      Publish update
                    </Button>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-white outline-none focus:border-[#FF2E74]/50"
                    placeholder="Policy title"
                  />
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={18}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 font-mono text-sm text-white outline-none focus:border-[#FF2E74]/50"
                    placeholder="HTML policy content"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#17171C] p-4">
                <div className="mb-3 flex items-center gap-2 text-white">
                  <History className="h-4 w-4 text-[#FF6B9D]" />
                  <h3 className="font-semibold">Version history</h3>
                </div>
                <div className="space-y-2">
                  {history.length === 0 ? (
                    <p className="text-sm text-[#A7A7B3]">No revisions yet.</p>
                  ) : (
                    history.map((revision) => (
                      <button
                        key={revision.id}
                        type="button"
                        onClick={() => openRevision(revision.id)}
                        className={cn(
                          'flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                          viewingRevision === revision.id
                            ? 'border-[#FF2E74]/40 bg-[#FF2E74]/10 text-white'
                            : 'border-white/8 text-[#A7A7B3] hover:border-white/15 hover:text-white',
                        )}
                      >
                        <span>
                          v{revision.version} — {revision.title}
                        </span>
                        <span className="text-xs">
                          {new Date(revision.publishedAt).toLocaleDateString()}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-[#A7A7B3]">Select a policy to edit.</p>
          )}
        </div>
      </div>
    </div>
  );
}