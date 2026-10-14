'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Brain, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  adminApi,
  type AIHostMemoryDetail,
  type AIHostMemoryItem,
} from '@/lib/api/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageLoader } from '@/components/shared/page-loader';

export default function AdminVirtualHostMemoryPage() {
  const [items, setItems] = useState<AIHostMemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AIHostMemoryDetail | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [filterHostId, setFilterHostId] = useState('');
  const [filterUserId, setFilterUserId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listAIHostMemories(
        filterHostId || undefined,
        filterUserId || undefined,
      );
      setItems(res.items ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load memories');
    } finally {
      setLoading(false);
    }
  }, [filterHostId, filterUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (hostId: string, userId: string) => {
    try {
      const detail = await adminApi.getAIHostMemory(hostId, userId);
      setSelected(detail);
      setEditNotes(detail.memory.notes ?? '');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load detail');
    }
  };

  const saveNotes = async () => {
    if (!selected) return;
    try {
      await adminApi.updateAIHostMemory(selected.memory.hostId, selected.memory.userId, {
        notes: editNotes,
      });
      toast.success('Memory updated');
      await openDetail(selected.memory.hostId, selected.memory.userId);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    }
  };

  const resetMemory = async (hostId: string, userId: string) => {
    try {
      await adminApi.resetVirtualHostMemory(hostId, userId);
      toast.success('Memory reset');
      setSelected(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reset failed');
    }
  };

  const deleteMemory = async (hostId: string, userId: string) => {
    try {
      await adminApi.deleteAIHostMemory(hostId, userId);
      toast.success('Memory deleted');
      setSelected(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  if (loading && !items.length) return <PageLoader />;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/virtual-hosts">
          <Button size="sm" variant="ghost">
            <ArrowLeft className="mr-1 h-4 w-4" /> Virtual Hosts
          </Button>
        </Link>
        <Brain className="h-6 w-6 text-[#FF2E74]" />
        <h1 className="text-xl font-bold text-white">AI Host Memory</h1>
        <Button size="sm" variant="outline" onClick={load}>
          <RefreshCw className="mr-1 h-3 w-3" /> Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Filter host ID"
          value={filterHostId}
          onChange={(e) => setFilterHostId(e.target.value)}
          className="max-w-xs"
        />
        <Input
          placeholder="Filter user ID"
          value={filterUserId}
          onChange={(e) => setFilterUserId(e.target.value)}
          className="max-w-xs"
        />
        <Button size="sm" onClick={load}>
          Apply
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
          <h2 className="mb-3 font-semibold text-white">Stored Memories ({items.length})</h2>
          <ul className="max-h-[28rem] space-y-2 overflow-y-auto text-sm">
            {items.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className="w-full rounded-lg border border-white/5 bg-white/5 p-3 text-left hover:border-[#FF2E74]/40"
                  onClick={() => openDetail(m.hostId, m.userId)}
                >
                  <p className="font-medium text-white">
                    {m.user.displayName} ↔ {m.host.displayName}
                  </p>
                  <p className="text-[#A7A7B3]">
                    {m.tier} · score {m.relationshipScore} · {m.callCount} calls
                  </p>
                  {m.nickname && <p className="text-[#FFB347]">Nickname: {m.nickname}</p>}
                </button>
              </li>
            ))}
            {!items.length && <li className="text-[#A7A7B3]">No memories yet</li>}
          </ul>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
          {!selected ? (
            <p className="text-[#A7A7B3]">Select a memory to view details</p>
          ) : (
            <div className="space-y-4">
              <h2 className="font-semibold text-white">
                {selected.memory.user.displayName} & {selected.memory.host.displayName}
              </h2>
              <div className="grid grid-cols-2 gap-2 text-sm text-[#E8E8F0]">
                <span>Relationship</span>
                <span>
                  {selected.memory.tier} ({selected.memory.relationshipScore})
                </span>
                <span>Nickname</span>
                <span>{selected.memory.nickname ?? '—'}</span>
                <span>Favorite color</span>
                <span>{selected.memory.favoriteColor ?? '—'}</span>
                <span>Favorite food</span>
                <span>{selected.memory.favoriteFood ?? '—'}</span>
                <span>Birthday</span>
                <span>{selected.memory.birthday ?? '—'}</span>
              </div>
              {selected.memory.memorySummary && (
                <p className="rounded-lg bg-white/5 p-2 text-sm text-[#A7A7B3]">
                  {selected.memory.memorySummary}
                </p>
              )}
              <div>
                <p className="mb-1 text-xs uppercase text-[#FFB347]">Edit notes</p>
                <textarea
                  className="w-full rounded-md border border-white/10 bg-black/40 p-2 text-sm text-white"
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
                <Button size="sm" className="mt-2" onClick={saveNotes}>
                  Save
                </Button>
              </div>
              <div>
                <p className="mb-2 text-xs uppercase text-[#FFB347]">Conversation History</p>
                <ul className="max-h-48 space-y-2 overflow-y-auto text-xs text-[#A7A7B3]">
                  {selected.conversationHistory.map((h) => (
                    <li key={h.id} className="rounded border border-white/5 p-2">
                      <p>
                        <strong className="text-white">User:</strong> {h.userMessage}
                      </p>
                      <p>
                        <strong className="text-[#FF2E74]">AI:</strong> {h.aiReply}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => resetMemory(selected.memory.hostId, selected.memory.userId)}
                >
                  Reset
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteMemory(selected.memory.hostId, selected.memory.userId)}
                >
                  <Trash2 className="mr-1 h-3 w-3" /> Delete
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}