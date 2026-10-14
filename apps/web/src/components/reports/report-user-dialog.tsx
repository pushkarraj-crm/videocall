'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Flag, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { reportsApi } from '@/lib/api/reports';
import { REPORT_REASONS, type ReportReason } from '@/lib/report-reasons';
import { cn } from '@/lib/utils';

type ReportUserDialogProps = {
  reportedUserId: string;
  reportedUserName?: string;
  callId?: string;
  trigger?: React.ReactNode;
  className?: string;
};

export function ReportUserDialog({
  reportedUserId,
  reportedUserName,
  callId,
  trigger,
  className,
}: ReportUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('harassment');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!reportedUserId) {
      toast.error('User not found');
      return;
    }
    setSubmitting(true);
    try {
      await reportsApi.create({
        reportedId: reportedUserId,
        category: reason,
        description: description.trim() || undefined,
        callId,
      });
      toast.success('Report submitted. Our team will review it shortly.');
      setOpen(false);
      setDescription('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not submit report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {trigger ? (
        <button type="button" className={className} onClick={() => setOpen(true)}>
          {trigger}
        </button>
      ) : (
        <Button
          variant="ghost"
          className={cn('text-[#A7A7B3] hover:text-white', className)}
          onClick={() => setOpen(true)}
        >
          <Flag className="mr-2 h-4 w-4" />
          Report user
        </Button>
      )}

      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              aria-label="Close report dialog"
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-modal
              className="fixed inset-x-4 top-[12%] z-[61] mx-auto max-w-md rounded-2xl border border-white/12 bg-[#121218]/95 p-5 shadow-2xl backdrop-blur-xl sm:inset-x-auto"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">Report user</h2>
                  {reportedUserName && (
                    <p className="mt-0.5 text-sm text-[#A7A7B3]">{reportedUserName}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1 text-[#A7A7B3] hover:bg-white/5 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-[#A7A7B3]">Reason</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {REPORT_REASONS.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setReason(r.value)}
                        className={cn(
                          'rounded-xl border px-3 py-2 text-left text-xs font-medium transition-colors',
                          reason === r.value
                            ? 'border-[#FF2E74]/40 bg-[#FF2E74]/10 text-white'
                            : 'border-white/8 bg-white/5 text-[#A7A7B3] hover:border-white/15',
                        )}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="report-desc" className="text-[#A7A7B3]">
                    Description (optional)
                  </Label>
                  <textarea
                    id="report-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    placeholder="Tell us what happened..."
                    className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-[#17171C] px-3 py-2 text-sm text-white placeholder:text-[#6B6B78] focus:outline-none focus:ring-2 focus:ring-[#FF2E74]/40"
                  />
                </div>

                <Button
                  className="w-full gradient-primary border-0"
                  disabled={submitting || !reportedUserId}
                  onClick={() => void submit()}
                >
                  {submitting ? 'Submitting...' : 'Submit report'}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}