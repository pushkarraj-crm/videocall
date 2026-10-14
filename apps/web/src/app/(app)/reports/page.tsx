'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ShieldAlert } from 'lucide-react';
import { ReportUserDialog } from '@/components/reports/report-user-dialog';
import { reportsApi, type ReportItem } from '@/lib/api/reports';
import { PageLoader } from '@/components/shared/page-loader';
import { EmptyState } from '@/components/shared/empty-state';
import { SettingsPageShell } from '@/components/settings/settings-page-shell';
import { SettingsBackHeader } from '@/components/settings/settings-back-header';

function ReportsContent() {
  const searchParams = useSearchParams();
  const reportedId = searchParams.get('userId') ?? '';
  const callId = searchParams.get('callId') ?? undefined;
  const [mine, setMine] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reportsApi
      .listMine()
      .then((res) => setMine(res.items))
      .catch(() => toast.error('Could not load your reports'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader variant="list" />;

  return (
    <SettingsPageShell narrow className="space-y-6">
      <SettingsBackHeader
        title="Safety & Reports"
        subtitle="Help keep the community safe"
        icon={<ShieldAlert className="h-5 w-5 text-[#FF2E74]" />}
      />

      {reportedId ? (
        <div className="rounded-2xl border border-white/10 bg-[#17171C]/95 p-5">
          <ReportUserDialog
            reportedUserId={reportedId}
            callId={callId}
            className="w-full"
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#17171C]/95">
          <EmptyState
            icon={ShieldAlert}
            title="Report from a profile or call"
            description="Open any user profile or active call screen and tap Report to submit an incident."
          />
        </div>
      )}

      {mine.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#6B6B78]">
            Your reports
          </h2>
          <div className="space-y-2">
            {mine.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-white/8 bg-[#17171C]/90 px-4 py-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{r.reasonLabel}</p>
                  <span className="text-xs text-[#A7A7B3]">{r.displayStatus}</span>
                </div>
                <p className="mt-0.5 text-sm text-[#A7A7B3]">
                  {r.reportedUser?.displayName ?? r.reportedUserId}
                </p>
                <p className="mt-1.5 text-[11px] text-[#6B6B78]">
                  {new Date(r.createdAt).toLocaleString('en-IN')}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </SettingsPageShell>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading..." />}>
      <ReportsContent />
    </Suspense>
  );
}
