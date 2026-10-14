'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Search, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  adminApi,
  type AdminUserListItem,
  type AdminUsersOverview,
} from '@/lib/api/admin';
import { cn } from '@/lib/utils';
import { AdminUserActions } from '@/components/admin/admin-user-actions';

const STATUS_FILTERS = ['', 'active', 'suspended', 'banned'] as const;

function OverviewCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#17171C]/95 to-[#1E1E26]/90 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#A7A7B3]">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-emerald-500/15 text-emerald-400',
    suspended: 'bg-amber-500/15 text-amber-400',
    banned: 'bg-red-500/15 text-red-400',
  };
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', styles[status] ?? 'bg-white/10 text-white')}>
      {status}
    </span>
  );
}

export default function AdminUsersPage() {
  const [overview, setOverview] = useState<AdminUsersOverview | null>(null);
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [accountStatus, setAccountStatus] = useState('');

  const load = useCallback(async () => {
    const res = await adminApi.getUsers({
      q: q || undefined,
      role: 'user',
      accountStatus: accountStatus || undefined,
      page,
      limit: 20,
    });
    setOverview(res.overview);
    setUsers(res.items);
    setTotal(res.total);
  }, [q, accountStatus, page]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load users'))
      .finally(() => setLoading(false));
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="premium-glow-bg min-h-full space-y-6 pb-10">
      <header className="flex items-center gap-3">
        <Users className="h-7 w-7 text-[#FF2E74]" />
        <div>
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="text-sm text-[#A7A7B3]">Manage app users and account status</p>
        </div>
      </header>

      {loading && !overview ? (
        <Skeleton className="h-24 w-48 rounded-2xl" />
      ) : overview ? (
        <OverviewCard label="Total Users" value={overview.totalUsers} />
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-[#17171C]/90 p-4 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A7A7B3]" />
            <Input
              placeholder="Search name, email, phone, user ID..."
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setPage(1);
                  void load();
                }
              }}
              className="border-white/10 bg-white/5 pl-10"
            />
          </div>
          <Button
            className="gradient-primary border-0"
            type="button"
            onClick={() => {
              setPage(1);
              void load();
            }}
          >
            Search
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <Button key={`status-${f}`} size="sm" variant={accountStatus === f ? 'default' : 'outline'}
              className={accountStatus === f ? 'gradient-primary border-0' : 'border-white/10'}
              onClick={() => { setAccountStatus(f); setPage(1); }}>
              {f || 'All Status'}
            </Button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#17171C]/90">
        <table className="min-w-[720px] w-full text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-[#A7A7B3]">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={5} className="px-4 py-3"><Skeleton className="h-10 w-full" /></td>
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-[#A7A7B3]">No users found</td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="text-white hover:bg-white/5">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={user.avatarUrl ?? undefined} />
                        <AvatarFallback>{user.displayName.slice(0, 1)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{user.displayName}</p>
                        <p className="text-xs text-[#A7A7B3]">{user.email ?? user.id.slice(0, 8) + '…'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{user.phone ?? '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={user.status} /></td>
                  <td className="px-4 py-3">
                    {new Date(user.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <AdminUserActions
                      userId={user.id}
                      status={user.status}
                      onChanged={() => void load()}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-[#A7A7B3]">{total} users · page {page} of {totalPages}</p>
        <div className="flex gap-2">
          <Button variant="outline" className="border-white/10" disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
          <Button variant="outline" className="border-white/10" disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}