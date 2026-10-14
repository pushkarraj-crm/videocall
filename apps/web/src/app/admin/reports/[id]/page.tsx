'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, type AdminReport } from '@/lib/api/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageLoader } from '@/components/shared/page-loader';
import { cn } from '@/lib/utils';

const RISK_STYLES: Record<string, string> = {
  FLAGGED: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  HIGH_RISK: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  RECOMMEND_SUSPENSION: 'bg-red-500/15 text-red-400 border-red-500/25',
};

export default function AdminReportDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [report, setReport] = useState<AdminReport | null>(null);
  const [previous, setPrevious] = useState<AdminReport[]>([]);
  const [reportCount, setReportCount] = useState(0);
  const [adminNote, setAdminNote] = useState('');
  const [resolution, setResolution] = useState('');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await adminApi.getReport(id);
    setReport(data.report);
    setPrevious(data.previousReports);
    setReportCount(data.reportedUserReportCount);
    setAdminNote(data.report.adminNote ?? '');
  }, [id]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const runAction = async (action: string, extra?: { enableCommunityWarning?: boolean }) => {
    setActing(action);
    try {
      await adminApi.updateReport(id, {
        action,
        resolution: resolution.trim() || undefined,
        adminNote: adminNote.trim() || undefined,
        ...extra,
      });
      toast.success('Report updated');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActing(null);
    }
  };

  if (loading || !report) return <PageLoader label="Loading report..." />;

  return (
    <div className="premium-glow-bg mx-auto max-w-3xl space-y-6 pb-10">
      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link href="/admin/reports">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to reports
        </Link>
      </Button>

      <div className="premium-card border-white/8 bg-[#17171C]/90 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">{report.reasonLabel}</h1>
            <p className="mt-1 text-sm text-[#A7A7B3]">Status: {report.displayStatus}</p>
          </div>
          {report.riskLevel !== 'NONE' && (
            <span
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-semibold',
                RISK_STYLES[report.riskLevel],
              )}
            >
              {report.riskLevel.replace(/_/g, ' ')} — recommendation only
            </span>
          )}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <InfoCard
            label="Reporter"
            name={report.reporter?.displayName ?? report.reporterId}
            id={report.reporterId}
          />
          <InfoCard
            label="Reported user"
            name={report.reportedUser?.displayName ?? report.reportedUserId}
            id={report.reportedUserId}
          />
        </div>

        {report.callId && (
          <p className="mt-4 text-sm text-[#A7A7B3]">
            Call ID: <span className="font-mono text-white">{report.callId}</span>
          </p>
        )}

        {report.description && (
          <div className="mt-4 rounded-xl bg-white/5 p-3 text-sm text-white/90">
            {report.description}
          </div>
        )}

        <p className="mt-3 text-xs text-[#6B6B78]">
          Submitted {new Date(report.createdAt).toLocaleString('en-IN')} · {reportCount} reports
          against this user
        </p>
      </div>

      {previous.length > 0 && (
        <section className="premium-card border-white/8 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#A7A7B3]">
            Previous reports ({previous.length})
          </h2>
          <div className="space-y-2">
            {previous.map((p) => (
              <Link
                key={p.id}
                href={`/admin/reports/${p.id}`}
                className="block rounded-lg border border-white/6 px-3 py-2 text-sm hover:bg-white/5"
              >
                <span className="font-medium">{p.reasonLabel}</span>
                <span className="ml-2 text-[#6B6B78]">{p.displayStatus}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="premium-card space-y-4 border-white/8 p-5">
        <h2 className="font-semibold text-white">Admin actions</h2>
        <div>
          <Label>Internal note</Label>
          <Input
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            placeholder="Visible to admins only"
            className="mt-1"
          />
        </div>
        <div>
          <Label>Resolution note</Label>
          <Input
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="Summary of action taken"
            className="mt-1"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { action: 'under_review', label: 'Under review' },
            { action: 'reject', label: 'Reject' },
            { action: 'resolve', label: 'Resolve' },
            { action: 'warning', label: 'Warning + community notice' },
            { action: 'suspend_user', label: 'Suspend user' },
            { action: 'suspend_host', label: 'Suspend host' },
            { action: 'permanent_ban', label: 'Permanent ban' },
            { action: 'internal_note', label: 'Save note only' },
          ].map(({ action, label }) => (
            <Button
              key={action}
              size="sm"
              variant={action.includes('ban') || action.includes('suspend') ? 'destructive' : 'outline'}
              disabled={acting !== null}
              onClick={() =>
                void runAction(action, {
                  enableCommunityWarning: action === 'warning',
                })
              }
            >
              {acting === action ? '...' : label}
            </Button>
          ))}
        </div>
      </section>
    </div>
  );
}

function InfoCard({ label, name, id }: { label: string; name: string; id: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/5 p-3">
      <p className="text-xs uppercase tracking-wider text-[#6B6B78]">{label}</p>
      <p className="mt-1 font-medium text-white">{name}</p>
      <Link href={`/admin/users/${id}`} className="text-xs text-[#FF6B9D] hover:underline">
        View user
      </Link>
    </div>
  );
}