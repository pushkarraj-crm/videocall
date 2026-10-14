export const LEGAL_POLICY_SLUGS = [
  'privacy',
  'terms',
  'refund-policy',
  'community-guidelines',
  'content-policy',
  'age-policy',
] as const;

export type LegalPolicySlug = (typeof LEGAL_POLICY_SLUGS)[number];

export const INITIAL_POLICY_VERSION = '1.0';

export interface LegalPolicyDefault {
  slug: LegalPolicySlug;
  title: string;
  content: string;
}

const brand = 'Lovenexa';
const supportEmail = 'support@lovenexa.com';
const grievanceEmail = 'grievance@lovenexa.com';

export const LEGAL_POLICY_DEFAULTS: LegalPolicyDefault[] = [
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    content: `
<h2>Introduction</h2>
<p>${brand} ("we", "us", "our") operates a social video communication platform. This Privacy Policy explains how we collect, use, store, and protect your personal data when you use our services. By using ${brand}, you agree to the practices described here.</p>

<h2>User Accounts</h2>
<p>When you register, we collect your phone number or authentication identifier, display name, date of birth, and profile information you choose to provide. We use this to create and secure your account, verify eligibility, and personalize your experience.</p>

<h2>Profile Data</h2>
<p>Profile data may include your display name, avatar, bio, language preferences, and host application details. Public profile fields are visible to other users according to your settings and platform rules.</p>

<h2>Call Data</h2>
<p>We record call metadata such as participants, start and end times, duration, call type (audio or video), routing decisions, and consent acknowledgements. We do not routinely record call audio or video unless required by law or explicit safety investigations.</p>

<h2>Wallet Data</h2>
<p>We maintain wallet balances, coin transactions, earnings, withdrawals, gifts sent and received, and referral bonuses. This data is required to operate our virtual economy and provide transaction history.</p>

<h2>Payments</h2>
<p>Payment information is processed by certified payment partners. We store order references, amounts, GST details, invoice numbers, and payment status. We do not store full card or UPI credentials on our servers.</p>

<h2>Cookies &amp; Local Storage</h2>
<p>We use cookies and local storage for session management, security tokens, age confirmation, and preference settings. You may clear browser storage, but some features may not function without essential cookies.</p>

<h2>Analytics</h2>
<p>We collect aggregated usage analytics such as feature adoption, crash reports, and performance metrics to improve reliability and user experience. Analytics data is pseudonymized where possible.</p>

<h2>Device Information</h2>
<p>We may collect device type, operating system, app version, IP address, and device fingerprint signals for fraud prevention, abuse detection, and security monitoring.</p>

<h2>Security</h2>
<p>We implement encryption in transit, access controls, audit logging, and monitoring to protect your data. No method of transmission over the internet is 100% secure; we continuously improve our safeguards.</p>

<h2>Data Retention</h2>
<p>We retain account and transaction data while your account is active and for a reasonable period thereafter to meet legal, tax, and dispute-resolution obligations. You may request deletion subject to regulatory requirements.</p>

<h2>Third-party Services</h2>
<p>We integrate with payment gateways, cloud infrastructure, authentication providers, real-time communication services, and analytics tools. These providers process data under contractual obligations consistent with this policy.</p>

<h2>Your Rights</h2>
<p>Subject to applicable law, you may request access, correction, or deletion of your personal data. Contact us using the details below. Security and transactional communications may continue while your account remains active.</p>

<h2>Contact Information</h2>
<p>Privacy inquiries: <a href="mailto:${supportEmail}">${supportEmail}</a><br/>Grievance officer: <a href="mailto:${grievanceEmail}">${grievanceEmail}</a></p>
`.trim(),
  },
  {
    slug: 'terms',
    title: 'Terms & Conditions',
    content: `
<h2>Agreement</h2>
<p>These Terms &amp; Conditions govern your use of ${brand}. By creating an account or using our services, you agree to these Terms, our Privacy Policy, and Community Guidelines.</p>

<h2>Eligibility</h2>
<p>You must be legally capable of entering a binding contract in your jurisdiction. You must provide accurate registration information and keep your account credentials secure.</p>

<h2>18+ Requirement</h2>
<p>${brand} is strictly for users aged 18 and above. By using the platform you confirm you are at least 18 years old. We may suspend accounts that fail age verification.</p>

<h2>User Responsibilities</h2>
<p>You are responsible for your conduct, content shared during calls, compliance with applicable laws, and maintaining sufficient coin balance for paid features. Misuse, harassment, or fraud may result in suspension.</p>

<h2>Payments</h2>
<p>All purchases are processed through authorized payment partners. Prices are displayed in Indian Rupees unless stated otherwise. Taxes and fees may apply as shown at checkout.</p>

<h2>Virtual Coins</h2>
<p>Coins are a limited license to access platform features. Coins have no cash value outside ${brand}, are non-transferable, and are subject to our Refund Policy.</p>

<h2>Calls</h2>
<p>Calls may be routed to AI hosts or real hosts based on availability and settings. Per-minute or per-session charges apply as displayed before you connect. You must obtain mutual consent before recording any call.</p>

<h2>AI Hosts</h2>
<p>AI hosts provide simulated conversation experiences powered by automated systems. Responses are generated algorithmically and do not constitute professional advice.</p>

<h2>Real Hosts</h2>
<p>Real hosts are independent users offering live conversation services. ${brand} facilitates connections and payments but does not guarantee availability, content, or outcomes of any interaction.</p>

<h2>Prohibited Activities</h2>
<ul>
<li>Harassment, threats, hate speech, or exploitation</li>
<li>Impersonation, spam, or fraudulent schemes</li>
<li>Sharing illegal content or attempting to circumvent payments</li>
<li>Reverse engineering, scraping, or attacking platform infrastructure</li>
</ul>

<h2>Intellectual Property</h2>
<p>All platform software, branding, and content provided by ${brand} remain our property or that of our licensors. You may not copy, modify, or distribute platform materials without permission.</p>

<h2>Account Suspension</h2>
<p>We may warn, suspend, or terminate accounts that violate these Terms or pose safety risks. Serious violations may result in permanent bans and forfeiture of unused virtual coins where permitted by law.</p>

<h2>Limitation of Liability</h2>
<p>To the maximum extent permitted by law, ${brand} is not liable for indirect, incidental, or consequential damages arising from your use of the service. Our total liability is limited to the amount you paid us in the preceding three months.</p>

<h2>Termination</h2>
<p>You may stop using ${brand} at any time. We may terminate or restrict access for violations, legal requirements, or business reasons with notice where practicable.</p>

<h2>Contact</h2>
<p>Legal inquiries: <a href="mailto:${supportEmail}">${supportEmail}</a></p>
`.trim(),
  },
  {
    slug: 'refund-policy',
    title: 'Refund Policy',
    content: `
<h2>Overview</h2>
<p>This Refund Policy explains how ${brand} handles coin recharges, payment disputes, and technical failures. Please read this before making a purchase.</p>

<h2>Recharge Policy</h2>
<p>Coin packages are digital goods delivered immediately upon successful payment. All recharges are final except where refunds are required by law or covered below.</p>

<h2>Non-refundable Coins</h2>
<p>Coins spent on calls, gifts, promotions, or other in-app features are non-refundable. Unused coin balances are generally non-refundable unless a qualifying issue below applies.</p>

<h2>Duplicate Payments</h2>
<p>If you are charged twice for the same order due to a technical error, contact support within 7 days with both transaction references. Verified duplicate charges will be refunded or credited.</p>

<h2>Technical Failure</h2>
<p>If payment succeeds but coins are not credited due to a platform failure, we will credit the missing coins or issue a refund after verification. Failed payments where no coins were delivered are not charged.</p>

<h2>Refund Eligibility</h2>
<ul>
<li>Unauthorized transactions reported within 48 hours</li>
<li>Verified duplicate payments</li>
<li>Confirmed technical failure without coin delivery</li>
<li>Chargebacks filed without contacting support may result in account suspension</li>
</ul>

<h2>Support Process</h2>
<p>Email <a href="mailto:${supportEmail}">${supportEmail}</a> with your registered phone number, order ID, payment reference, and a description of the issue. We respond within 3 business days and resolve eligible cases within 14 business days.</p>
`.trim(),
  },
  {
    slug: 'community-guidelines',
    title: 'Community Guidelines',
    content: `
<h2>Our Community</h2>
<p>${brand} is built for respectful, consensual connections. These guidelines apply to all users and hosts.</p>

<h2>No Harassment</h2>
<p>Do not bully, stalk, or repeatedly contact someone who has declined interaction.</p>

<h2>No Threats</h2>
<p>Threats of violence, self-harm encouragement, or intimidation are prohibited.</p>

<h2>No Hate Speech</h2>
<p>Content attacking people based on race, religion, gender, sexuality, disability, or nationality is not allowed.</p>

<h2>No Spam</h2>
<p>Do not send unsolicited promotions, repetitive messages, or automated solicitations.</p>

<h2>No Fraud</h2>
<p>Scams, chargeback abuse, payment manipulation, and identity fraud will result in permanent bans.</p>

<h2>No Illegal Content</h2>
<p>Do not share or request content that violates applicable law, including exploitation of minors.</p>

<h2>Respect Other Users</h2>
<p>Honor boundaries, obtain consent, and treat others with dignity during calls and messages.</p>

<h2>Safety</h2>
<p>Report violations using in-app tools. We investigate reports and may take action including warnings, suspensions, or law-enforcement referral.</p>
`.trim(),
  },
  {
    slug: 'content-policy',
    title: 'Content Moderation Policy',
    content: `
<h2>Purpose</h2>
<p>This policy describes how ${brand} moderates content and enforces safety standards across calls, profiles, and communications.</p>

<h2>Reports</h2>
<p>Users may report profiles, calls, or behavior through in-app reporting. Reports are reviewed by trained moderators and automated risk systems.</p>

<h2>Blocking</h2>
<p>Users may block others to prevent further contact. Blocked users cannot initiate calls or messages with you.</p>

<h2>Host Suspension</h2>
<p>Hosts who violate guidelines may receive warnings, temporary suspensions, or permanent removal from the host program. Earnings may be held during investigations.</p>

<h2>User Suspension</h2>
<p>Users who abuse the platform may be suspended or banned. Repeated or severe violations result in permanent account termination.</p>

<h2>Content Removal</h2>
<p>We may remove profile content, bios, or media that violates our policies without prior notice when safety is at risk.</p>

<h2>Investigation Process</h2>
<p>Reports are triaged by severity. We may review call metadata, user history, and submitted evidence. Parties may be contacted for clarification.</p>

<h2>Repeat Violations</h2>
<p>Escalating enforcement applies to repeat offenders: warning → temporary suspension → permanent ban. Critical violations may skip earlier steps.</p>

<h2>Appeals</h2>
<p>Contact <a href="mailto:${grievanceEmail}">${grievanceEmail}</a> to appeal moderation decisions within 14 days of notification.</p>
`.trim(),
  },
  {
    slug: 'age-policy',
    title: 'Age Verification Policy',
    content: `
<h2>Minimum Age</h2>
<p>${brand} is available only to individuals who are 18 years of age or older. We do not knowingly permit minors to use our services.</p>

<h2>Verification</h2>
<p>During registration you must confirm your date of birth and declare that you are 18 or older. We may request additional verification for hosts or flagged accounts.</p>

<h2>Age Gate</h2>
<p>Before accessing the platform you must confirm you are at least 18. If you decline, access is blocked until confirmation is provided.</p>

<h2>Underage Accounts</h2>
<p>Accounts found to belong to minors are terminated immediately and associated data deleted where legally permissible.</p>

<h2>Reporting</h2>
<p>Report suspected underage users via in-app reporting or <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>
`.trim(),
  },
];

export function getDefaultPolicy(slug: string): LegalPolicyDefault | undefined {
  return LEGAL_POLICY_DEFAULTS.find((p) => p.slug === slug);
}