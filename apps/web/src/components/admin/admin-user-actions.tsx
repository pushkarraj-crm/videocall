'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { adminApi } from '@/lib/api/admin';

type AdminUserActionsProps = {
  userId: string;
  status: string;
  onChanged: () => void;
};

export function AdminUserActions({ userId, status, onChanged }: AdminUserActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isBlocked = status === 'banned';

  const run = async (label: string, action: () => Promise<unknown>) => {
    setLoading(label);
    try {
      await action();
      toast.success(label);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setLoading(null);
    }
  };

  const confirmDelete = async () => {
    setLoading('delete');
    try {
      await adminApi.deleteUser(userId);
      toast.success('User deleted');
      setDeleteOpen(false);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="border-white/10"
          onClick={() => router.push(`/admin/users/${userId}`)}
        >
          View
        </Button>
        {isBlocked ? (
          <Button
            size="sm"
            variant="outline"
            className="border-emerald-500/30 text-emerald-400"
            disabled={!!loading}
            onClick={() => run('User unblocked', () => adminApi.unblockUser(userId))}
          >
            Unblock
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="border-amber-500/30 text-amber-400"
            disabled={!!loading}
            onClick={() => run('User blocked', () => adminApi.blockUser(userId, 'Blocked by admin'))}
          >
            Block
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="border-red-500/30 text-red-400"
          disabled={!!loading}
          onClick={() => setDeleteOpen(true)}
        >
          Delete
        </Button>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="border-white/10 bg-[#17171C] text-white">
          <DialogHeader>
            <DialogTitle>Delete this user permanently?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-white/60">
            This removes the account, profile, wallet, and sessions. This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="border-white/10" onClick={() => setDeleteOpen(false)}>
              No
            </Button>
            <Button
              variant="destructive"
              loading={loading === 'delete'}
              onClick={() => void confirmDelete()}
            >
              Yes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}