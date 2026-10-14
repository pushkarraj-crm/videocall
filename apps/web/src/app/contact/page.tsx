import Link from 'next/link';
import { Mail, MessageSquare } from 'lucide-react';
import { LegalDocument } from '@/components/shared/legal-document';
import { LegalFooterLinks } from '@/components/legal/legal-footer-links';
import { appTitleOr } from '@/lib/app-brand';

export default function ContactPage() {
  const brand = appTitleOr();
  return (
    <LegalDocument title={`Contact ${brand}`} backHref="/">
      <p>
        We are here to help with account, payment, safety, and legal inquiries. Choose the channel
        that best fits your request.
      </p>

      <h2>General Support</h2>
      <p>
        Email{' '}
        <a href="mailto:support@lovenexa.com" className="text-[#FF6B9D] hover:underline">
          support@lovenexa.com
        </a>{' '}
        for wallet, calls, technical issues, and refund requests. Include your registered phone
        number and order ID when applicable.
      </p>

      <h2>Grievance Officer</h2>
      <p>
        For moderation appeals and compliance matters, contact{' '}
        <a href="mailto:grievance@lovenexa.com" className="text-[#FF6B9D] hover:underline">
          grievance@lovenexa.com
        </a>
        .
      </p>

      <h2>Submit a Ticket</h2>
      <p>
        You can also file a formal grievance through our API-backed support channel while signed in,
        or describe your issue via email.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <a
          href="mailto:support@lovenexa.com"
          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-[#FF2E74]/40"
        >
          <Mail className="h-5 w-5 text-[#FF6B9D]" />
          <span className="text-sm text-white/90">support@lovenexa.com</span>
        </a>
        <Link
          href="/login"
          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-[#FF2E74]/40"
        >
          <MessageSquare className="h-5 w-5 text-[#FF6B9D]" />
          <span className="text-sm text-white/90">Sign in for in-app support</span>
        </Link>
      </div>

      <div className="mt-8 border-t border-white/10 pt-6">
        <LegalFooterLinks className="text-xs text-white/40" />
      </div>
    </LegalDocument>
  );
}