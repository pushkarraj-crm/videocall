'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronLeft, ChevronRight, Loader2, Sparkles, User } from 'lucide-react';
import { toast } from 'sonner';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageLoader } from '@/components/shared/page-loader';
import { useAuth } from '@/hooks/use-auth';
import { authApi } from '@/lib/api/auth';
import { hostsApi } from '@/lib/api/hosts';
import { usersApi } from '@/lib/api/users';
import { finalizeHostRegistration, HostRegistrationError } from '@/lib/auth/host-registration';
import { devLog } from '@/lib/dev-log';
import { cn } from '@/lib/utils';

const GENDERS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const LANGUAGES = ['English', 'Hindi', 'Tamil', 'Telugu', 'Bengali', 'Marathi', 'Kannada'];

const STEPS = ['Welcome', 'Photo', 'Profile', 'Finish'];

export default function HostRegisterPage() {
  const router = useRouter();
  const { isAuthenticated, session } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [form, setForm] = useState({
    displayName: '',
    age: '',
    gender: '',
    country: 'IN',
    languages: [] as string[],
    bio: '',
    photoUrl: '',
  });

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/become-host');
      return;
    }

    hostsApi
      .getApplication()
      .then((app) => {
        devLog('HOST_REGISTER_GATE', {
          status: app.status,
          isHost: app.isHost,
          canAccessDashboard: app.canAccessDashboard,
        });
        if (app.canAccessDashboard) {
          router.replace('/host/dashboard');
          return;
        }
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [isAuthenticated, session, router]);

  const toggleLanguage = (lang: string) => {
    setForm((f) => ({
      ...f,
      languages: f.languages.includes(lang)
        ? f.languages.filter((l) => l !== lang)
        : [...f.languages, lang],
    }));
  };

  const canNext = () => {
    if (step === 2) {
      return form.displayName.trim() && form.age && form.gender && form.languages.length > 0;
    }
    return true;
  };

  const submit = async () => {
    const age = parseInt(form.age, 10);
    if (age < 18) {
      toast.error('You must be 18 or older');
      return;
    }

    const year = new Date().getFullYear() - age;
    const dateOfBirth = `${year}-06-15`;
    const bioText =
      form.bio.trim() ||
      `Languages: ${form.languages.join(', ')}`;

    setLoading(true);
    try {
      const needsOnboarding = session?.user.needsOnboarding;
      devLog('HOST_REGISTER_SUBMIT_START', { needsOnboarding, userId: session?.user.id });

      if (needsOnboarding) {
        await authApi.completeOnboarding({
          displayName: form.displayName.trim(),
          dateOfBirth,
          gender: form.gender as 'male' | 'female' | 'other' | 'prefer_not_to_say',
          primaryLanguage: form.languages[0]?.slice(0, 2).toLowerCase() ?? 'en',
          bio: bioText,
          acceptTerms: true,
          acceptPrivacy: true,
          acceptCommunityGuidelines: true,
          ageDeclaration: true,
        });
      } else {
        await usersApi.updateMe({
          displayName: form.displayName.trim(),
          gender: form.gender as 'male' | 'female' | 'other' | 'prefer_not_to_say',
          bio: bioText,
          primaryLanguage: form.languages[0]?.slice(0, 2).toLowerCase(),
          ...(form.photoUrl.trim() ? { avatarUrl: form.photoUrl.trim() } : {}),
        });
      }

      await finalizeHostRegistration();
      toast.success('Welcome! Your host profile is ready — go online and start earning.');
      router.replace('/host/dashboard');
    } catch (e) {
      if (e instanceof HostRegistrationError) {
        devLog('HOST_REGISTER_FAIL', { code: e.code, message: e.message });
        toast.error(e.message);
        return;
      }
      devLog('HOST_REGISTER_FAIL', { message: e instanceof Error ? e.message : String(e) });
      toast.error(e instanceof Error ? e.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (checking) return <PageLoader label="Loading..." />;

  return (
    <AuthLayout className="max-w-lg">
      <div className="mb-6 flex justify-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                i <= step
                  ? 'bg-[#FF2E74]/25 text-[#FF8CB3] ring-1 ring-[#FF6B9D]/40'
                  : 'bg-white/5 text-white/30',
              )}
            >
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('h-px w-6', i < step ? 'bg-[#FF6B9D]/50' : 'bg-white/10')} />
            )}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FF2E74]/15">
            <Sparkles className="h-8 w-8 text-[#FF6B9D]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Become a Host</h2>
            <p className="mt-2 text-sm text-white/50">
              Join in under a minute. No documents. No waiting. Start earning from video calls.
            </p>
          </div>
          <ul className="space-y-2 text-left text-sm text-white/70">
            {['Go online instantly', 'Receive paid calls', 'Withdraw your earnings'].map((t) => (
              <li key={t} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
                <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Profile Photo</h2>
          <p className="text-sm text-white/50">Optional — add a photo URL or skip for now</p>
          <div className="flex justify-center py-4">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/10 ring-2 ring-white/10">
              {form.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.photoUrl}
                  alt="Preview"
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <User className="h-10 w-10 text-white/30" />
              )}
            </div>
          </div>
          <div>
            <Label className="text-white/70">Photo URL</Label>
            <Input
              className="mt-1 border-white/10 bg-white/5 text-white"
              value={form.photoUrl}
              onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
              placeholder="https://..."
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Basic Information</h2>
          <div>
            <Label className="text-white/70">Display Name *</Label>
            <Input
              className="mt-1 border-white/10 bg-white/5 text-white"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-white/70">Age *</Label>
              <Input
                type="number"
                min={18}
                className="mt-1 border-white/10 bg-white/5 text-white"
                value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-white/70">Gender *</Label>
              <select
                className="mt-1 h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white"
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
              >
                <option value="" className="bg-[#12121A]">Select</option>
                {GENDERS.map((g) => (
                  <option key={g.value} value={g.value} className="bg-[#12121A]">
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label className="text-white/70">Country</Label>
            <select
              className="mt-1 h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white"
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
            >
              <option value="IN" className="bg-[#12121A]">India</option>
              <option value="US" className="bg-[#12121A]">United States</option>
              <option value="GB" className="bg-[#12121A]">United Kingdom</option>
              <option value="AE" className="bg-[#12121A]">UAE</option>
            </select>
          </div>
          <div>
            <Label className="text-white/70">Languages *</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => toggleLanguage(lang)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    form.languages.includes(lang)
                      ? 'bg-[#FF2E74]/25 text-[#FF8CB3] ring-1 ring-[#FF6B9D]/40'
                      : 'bg-white/5 text-white/50 hover:bg-white/10',
                  )}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-white/70">Short Bio</Label>
            <Input
              className="mt-1 border-white/10 bg-white/5 text-white"
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="Tell callers about yourself"
            />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15">
            <Check className="h-8 w-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white">You&apos;re all set!</h2>
          <p className="text-sm text-white/50">
            Tap finish to create your host profile and open your dashboard.
          </p>
          <div className="rounded-xl bg-white/5 p-4 text-left text-sm text-white/70">
            <p><span className="text-white/40">Name:</span> {form.displayName}</p>
            <p><span className="text-white/40">Languages:</span> {form.languages.join(', ')}</p>
          </div>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        {step > 0 && (
          <Button
            variant="outline"
            className="flex-1 border-white/10 bg-white/5 text-white"
            onClick={() => setStep((s) => s - 1)}
            disabled={loading}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
        )}
        {step < 3 ? (
          <Button
            className="flex-1 gradient-primary border-0"
            disabled={!canNext()}
            onClick={() => setStep((s) => s + 1)}
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button
            className="flex-1 gradient-primary border-0"
            onClick={submit}
            disabled={loading}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Go to Dashboard
          </Button>
        )}
      </div>
    </AuthLayout>
  );
}