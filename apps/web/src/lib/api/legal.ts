import { apiClient } from './client';

export interface LegalPolicySummary {
  slug: string;
  title: string;
  version: string;
  publishedAt: string;
  lastUpdated: string;
  isPublished?: boolean;
  revisionCount?: number;
}

export interface LegalPolicyDetail extends LegalPolicySummary {
  content: string;
  publishedBy: { id: string; displayName: string } | null;
}

export interface LegalPolicyRevision {
  id: string;
  version: string;
  title: string;
  publishedAt: string;
  publishedBy: { id: string; displayName: string } | null;
}

export const legalApi = {
  listPublished() {
    return apiClient<{ items: LegalPolicySummary[] }>('/legal/policies', { auth: false });
  },

  getPublished(slug: string) {
    return apiClient<LegalPolicyDetail>(`/legal/policies/${slug}`, { auth: false });
  },

  listAdmin() {
    return apiClient<{ items: LegalPolicyDetail[] }>('/admin/compliance/policies');
  },

  getHistory(slug: string) {
    return apiClient<{ slug: string; currentVersion: string; items: LegalPolicyRevision[] }>(
      `/admin/compliance/policies/${slug}/history`,
    );
  },

  getRevision(slug: string, revisionId: string) {
    return apiClient<LegalPolicyRevision & { content: string; slug: string }>(
      `/admin/compliance/policies/${slug}/history/${revisionId}`,
    );
  },

  updatePolicy(
    slug: string,
    body: { title?: string; content?: string; publish?: boolean },
  ) {
    return apiClient<LegalPolicyDetail>(`/admin/compliance/policies/${slug}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
};