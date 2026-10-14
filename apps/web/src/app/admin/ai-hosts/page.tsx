'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bot, Plus, Trash2, Pencil, Power, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, type AdminVirtualHostItem } from '@/lib/api/admin';
import { ApiClientError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/shared/page-loader';
import { cn } from '@/lib/utils';

export default function AdminAiHostsPage() {
  const [items, setItems] = useState<AdminVirtualHostItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await adminApi.virtualHosts();
      setItems(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load AI hosts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleEnabled = async (host: AdminVirtualHostItem) => {
    try {
      await adminApi.updateVirtualHost(host.hostId, {
        virtualHostEnabled: !host.virtualHostEnabled,
        virtualHostStatus: !host.virtualHostEnabled ? 'ONLINE' : 'OFFLINE',
      });
      toast.success(host.virtualHostEnabled ? 'Host disabled' : 'Host enabled');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const remove = async (hostId: string, name: string) => {
    if (!confirm(`Delete AI host "${name}"? This removes videos and gallery assets.`)) return;
    try {
      await adminApi.deleteVirtualHost(hostId);
      toast.success('AI host deleted');
      await load();
    } catch (e) {
      const message =
        e instanceof ApiClientError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Delete failed';
      toast.error(message);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <Bot className="h-7 w-7 text-[#FF2E74]" />
            AI Hosts
          </h1>
          <p className="mt-1 text-sm text-[#A7A7B3]">
            Create, upload videos, and manage AI hosts for Discover and call fallback.
          </p>
        </div>
        <Button asChild className="gradient-primary border-0">
          <Link href="/admin/ai-hosts/new">
            <Plus className="mr-2 h-4 w-4" />
            Add AI Host
          </Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#17171C] p-12 text-center">
          <p className="text-[#A7A7B3]">No AI hosts yet. Create your first host to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((host) => (
            <article
              key={host.hostId}
              className="overflow-hidden rounded-2xl border border-white/10 bg-[#17171C]"
            >
              <div className="flex gap-4 p-4">
                {host.user.avatarUrl ? (
                  <img
                    src={host.user.avatarUrl}
                    alt={host.user.displayName}
                    className="h-16 w-16 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[#FF2E74]/20 text-xl font-bold text-white">
                    {host.user.displayName[0]}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold text-white">{host.user.displayName}</h2>
                  <p className="text-xs text-[#A7A7B3]">
                    {host.videoCount ?? 0} videos ·{' '}
                    {host.createdAt ? new Date(host.createdAt).toLocaleDateString() : '—'}
                  </p>
                  <span
                    className={cn(
                      'mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium',
                      host.virtualHostEnabled && host.isOnline
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-white/10 text-[#A7A7B3]',
                    )}
                  >
                    {host.virtualHostEnabled
                      ? host.virtualHostStatus ?? 'ONLINE'
                      : 'DISABLED'}
                  </span>
                </div>
              </div>
              <div className="flex border-t border-white/8">
                <Button asChild variant="ghost" size="sm" className="flex-1 rounded-none">
                  <Link href={`/admin/ai-hosts/${host.hostId}`}>
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    Edit
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm" className="flex-1 rounded-none">
                  <Link href={`/profiles/${host.user.id}`} target="_blank">
                    <Eye className="mr-1 h-3.5 w-3.5" />
                    Preview
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 rounded-none"
                  onClick={() => void toggleEnabled(host)}
                >
                  <Power className="mr-1 h-3.5 w-3.5" />
                  {host.virtualHostEnabled ? 'Disable' : 'Enable'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 rounded-none text-red-400 hover:text-red-300"
                  onClick={() => void remove(host.hostId, host.user.displayName)}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}