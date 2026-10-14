import { LegalDocument } from '@/components/shared/legal-document';
import { getPolicy, type PolicyView } from '@/lib/legal/policies';
import type { LegalPolicySlug } from '@/lib/legal/policy-defaults';
import { sanitizeLegalHtml } from '@/lib/legal/sanitize-html';

export async function LegalPage({ slug }: { slug: LegalPolicySlug }) {
  const policy = await getPolicy(slug);
  return <LegalPageView policy={policy} />;
}

export function LegalPageView({
  policy,
  backHref = '/',
}: {
  policy: PolicyView & { updatedLabel?: string };
  backHref?: string;
}) {
  const updated =
    policy.updatedLabel ??
    new Date(policy.lastUpdated ?? policy.publishedAt).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  return (
    <LegalDocument title={policy.title} updated={updated} version={policy.version} backHref={backHref}>
      <div dangerouslySetInnerHTML={{ __html: sanitizeLegalHtml(policy.content) }} />
    </LegalDocument>
  );
}