import {
  INITIAL_POLICY_VERSION,
  LEGAL_POLICY_DEFAULTS,
  type LegalPolicySlug,
} from '@/lib/legal/policy-defaults';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1';

export interface PolicyView {
  slug: string;
  title: string;
  content: string;
  version: string;
  publishedAt: string;
  lastUpdated: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function staticPolicy(slug: LegalPolicySlug): PolicyView {
  const policy = LEGAL_POLICY_DEFAULTS.find((p) => p.slug === slug)!;
  const now = new Date().toISOString();
  return {
    slug: policy.slug,
    title: policy.title,
    content: policy.content,
    version: INITIAL_POLICY_VERSION,
    publishedAt: now,
    lastUpdated: now,
  };
}

export async function getPolicy(slug: LegalPolicySlug): Promise<PolicyView & { updatedLabel: string }> {
  try {
    const res = await fetch(`${API_BASE}/legal/policies/${slug}`, {
      next: { revalidate: 300 },
    });
    const json = await res.json();
    if (res.ok && json.success && json.data) {
      const data = json.data as PolicyView;
      return {
        ...data,
        updatedLabel: formatDate(data.lastUpdated ?? data.publishedAt),
      };
    }
  } catch {
    // fall through to static content
  }

  const fallback = staticPolicy(slug);
  return {
    ...fallback,
    updatedLabel: formatDate(fallback.lastUpdated),
  };
}

export const POLICY_LINKS = [
  { href: '/privacy', label: 'Privacy Policy', slug: 'privacy' as const },
  { href: '/terms', label: 'Terms & Conditions', slug: 'terms' as const },
  { href: '/refund-policy', label: 'Refund Policy', slug: 'refund-policy' as const },
  { href: '/community-guidelines', label: 'Community Guidelines', slug: 'community-guidelines' as const },
  { href: '/content-policy', label: 'Content Policy', slug: 'content-policy' as const },
  { href: '/age-policy', label: 'Age Policy', slug: 'age-policy' as const },
  { href: '/contact', label: 'Contact', slug: null },
] as const;