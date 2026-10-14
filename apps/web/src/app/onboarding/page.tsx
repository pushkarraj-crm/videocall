'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/stores/auth-store';
import { typography } from '@/lib/design-tokens';

export default function OnboardingPage() {
  const router = useRouter();
  const setProfile = useAuthStore((s) => s.setProfile);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    displayName: '',
    dateOfBirth: '',
    bio: '',
    referralCode: '',
    acceptTerms: false,
    acceptPrivacy: false,
    acceptCommunityGuidelines: false,
    ageDeclaration: false,
  });

  const submit = async () => {
    setLoading(true);
    try {
      const result = await authApi.completeOnboarding(form);
      setProfile(result.user);
      toast.success('Profile created!');
      router.push('/home');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit =
    form.displayName &&
    form.dateOfBirth &&
    form.acceptTerms &&
    form.acceptPrivacy &&
    form.acceptCommunityGuidelines &&
    form.ageDeclaration;

  return (
    <div className="relative min-h-dvh bg-[#0F0F12]">
      <AuthLayout
        title="Create your profile"
        subtitle="A few details to personalize your experience"
        className="max-w-lg"
      >
        <div className="premium-glass animate-slide-up space-y-5 rounded-[24px] p-6">
          <div className="flex items-center gap-2 text-[#FFB347]">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Welcome</span>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className={typography.label}>Display name</Label>
              <Input
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="How should we call you?"
              />
            </div>
            <div className="space-y-2">
              <Label className={typography.label}>Date of birth (18+)</Label>
              <Input
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className={typography.label}>Bio (optional)</Label>
              <Input
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="Say hello to the community"
              />
            </div>
            <div className="space-y-2">
              <Label className={typography.label}>Referral code (optional)</Label>
              <Input
                value={form.referralCode}
                onChange={(e) => setForm({ ...form, referralCode: e.target.value })}
                placeholder="FRIEND-CODE"
              />
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            {(
              [
                ['acceptTerms', 'I accept the', 'Terms & Conditions', '/terms'],
                ['acceptPrivacy', 'I accept the', 'Privacy Policy', '/privacy'],
                ['acceptCommunityGuidelines', 'I accept the', 'Community Guidelines', '/community-guidelines'],
                ['ageDeclaration', 'I confirm I am 18 or older per the', 'Age Policy', '/age-policy'],
              ] as const
            ).map(([key, prefix, linkLabel, href]) => (
              <label key={key} className="flex items-center justify-between gap-3 text-sm text-white/90">
                <span>
                  {prefix}{' '}
                  <Link href={href} className="text-[#FF6B9D] hover:underline" target="_blank">
                    {linkLabel}
                  </Link>
                </span>
                <Switch
                  checked={form[key]}
                  onCheckedChange={(v) => setForm({ ...form, [key]: v })}
                />
              </label>
            ))}
          </div>

          <Button
            className="w-full"
            variant="gradient"
            size="lg"
            disabled={!canSubmit}
            loading={loading}
            onClick={submit}
          >
            Get started
          </Button>
        </div>
      </AuthLayout>
    </div>
  );
}