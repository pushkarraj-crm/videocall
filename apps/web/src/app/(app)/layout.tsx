import { AppShell } from '@/components/layout/app-shell';
import { AgeGateShell } from '@/components/layout/age-gate-shell';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AgeGateShell>
      <AppShell>{children}</AppShell>
    </AgeGateShell>
  );
}