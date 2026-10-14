import { redirect } from 'next/navigation';

export default function LegacyVirtualHostsPage() {
  redirect('/admin/ai-hosts');
}