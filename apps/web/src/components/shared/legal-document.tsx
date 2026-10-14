import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Screen } from '@/components/shared/screen';
import { BrandLogo } from '@/components/brand/brand-logo';

interface LegalDocumentProps {
  title: string;
  updated?: string;
  version?: string;
  backHref?: string;
  children: React.ReactNode;
}

export function LegalDocument({
  title,
  updated,
  version,
  backHref = '/',
  children,
}: LegalDocumentProps) {
  return (
    <Screen className="mx-auto max-w-2xl">
      <Link
        href={backHref}
        className="mb-6 inline-flex items-center gap-2 text-sm text-[#A7A7B3] transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>
      <div className="premium-card p-6 md:p-8">
        <BrandLogo size="sm" className="mb-1" />
        <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
        <div className="mt-1 flex flex-wrap gap-3 text-xs text-[#A7A7B3]">
          {version && <span>Version {version}</span>}
          {updated && <span>Last updated {updated}</span>}
        </div>
        <div className="prose-legal mt-6 space-y-4">{children}</div>
      </div>
    </Screen>
  );
}