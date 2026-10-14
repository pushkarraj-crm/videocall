'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/use-auth';
import { authApi } from '@/lib/api/auth';
import type { AuthIntent } from '@/lib/auth/constants';
import { setAuthIntent } from '@/lib/auth/intent';

const COUNTRY_CODES = [
  { code: '+91', label: '🇮🇳 +91' },
  { code: '+1', label: '🇺🇸 +1' },
  { code: '+44', label: '🇬🇧 +44' },
  { code: '+971', label: '🇦🇪 +971' },
];

function GoogleIcon() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function LoginForm({
  intent = 'user',
  showBecomeHost = true,
  tagline = 'Meet New People',
  subtitle = '',
}: {
  intent?: AuthIntent;
  showBecomeHost?: boolean;
  tagline?: string;
  subtitle?: string;
}) {
  const router = useRouter();
  const { loginWithPassword, registerWithPassword } = useAuth();
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'phone' | 'email'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState('');

  const fullPhone = `${countryCode}${phoneLocal.replace(/\D/g, '')}`;

  const handleGoogle = async () => {
    if (loading) return;
    setLoading(true);
    setAuthIntent(intent);
    try {
      const methods = await authApi.methods();
      if (!methods.google) throw new Error('Google login is awaiting configuration. Please use email or phone for now.');
      window.location.assign(authApi.googleStartUrl(intent));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Google login is unavailable');
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    if (!email.trim() || !password || (isSignup && password.length < 12)) {
      toast.error(isSignup ? 'Use an email and a password with at least 12 characters.' : 'Enter your email and password.');
      return;
    }
    setLoading(true);
    setAuthIntent(intent);
    try {
      if (isSignup) await registerWithPassword(email.trim(), password, name.trim() || email.split('@')[0], intent);
      else await loginWithPassword(email.trim(), password, intent);
      toast.success(isSignup ? 'Account created! Check your inbox to verify your email.' : 'Welcome back!');
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'EMAIL_IN_USE') setIsSignup(false);
      toast.error(error instanceof Error ? error.message : 'Unable to sign in');
    } finally { setLoading(false); }
  };

  const sendOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!/^\+[1-9]\d{7,14}$/.test(fullPhone)) {
      toast.error('Enter a valid phone number'); return;
    }
    setLoading(true);
    setAuthIntent(intent);
    try {
      const result = await authApi.requestOtp(fullPhone, intent);
      sessionStorage.setItem('platform-otp', JSON.stringify({ ...result, phone: fullPhone, intent, sentAt: Date.now() }));
      router.push('/login/otp');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not send code');
    } finally { setLoading(false); }
  };
  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="text-lg font-semibold text-white">{tagline}</p>
        {subtitle ? <p className="text-sm text-white/50">{subtitle}</p> : null}
      </div>

      <Button
        type="button"
        className="h-12 w-full border border-white/10 bg-white text-base font-medium text-black hover:bg-white/90"
        onClick={handleGoogle}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <GoogleIcon />
        )}
        Continue with Google
      </Button>

      <div className="flex items-center gap-3">
        <Separator className="flex-1 bg-white/10" />
        <span className="text-xs font-medium uppercase tracking-wider text-white/35">or</span>
        <Separator className="flex-1 bg-white/10" />
      </div>

      <div className="flex gap-2 rounded-xl bg-white/5 p-1" role="tablist" aria-label="Sign-in method">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'phone'}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
            mode === 'phone' ? 'bg-white/10 text-white' : 'text-white/50'
          }`}
          onClick={() => setMode('phone')}
        >
          Phone
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'email'}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
            mode === 'email' ? 'bg-white/10 text-white' : 'text-white/50'
          }`}
          onClick={() => setMode('email')}
        >
          Email
        </button>
      </div>

      {mode === 'email' ? (
        <form
          method="post"
          action="#"
          className="space-y-3"
          onSubmit={(e) => void handleEmailSubmit(e)}
          noValidate
        >
          {isSignup && intent !== 'admin' && (
            <Input
              name="name"
              autoComplete="name"
              placeholder="Your name"
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 border-white/10 bg-white/5 text-white"
              disabled={loading}
            />
          )}
          <Input
            type="email"
            name="email"
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 border-white/10 bg-white/5 text-white"
            disabled={loading}
            required
          />
          <Input
            type="password"
            name="password"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 border-white/10 bg-white/5 text-white"
            disabled={loading}
            required
            minLength={isSignup ? 12 : 1}
            maxLength={128}
          />
          <Button
            type="submit"
            className="h-11 w-full gradient-primary border-0"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isSignup ? (
              'Sign Up'
            ) : (
              'Log In'
            )}
          </Button>
          <div className="flex justify-between text-xs">
            {intent !== 'admin' && (
            <button
              type="button"
              className="text-[#FF6B9D] hover:underline"
              disabled={loading}
              onClick={() => setIsSignup((s) => !s)}
            >
              {isSignup ? 'Already have an account?' : 'Create account'}
            </button>
            )}
            {!isSignup && (
              <Link href="/login/forgot-password" className="text-white/50 hover:text-white">
                Forgot password?
              </Link>
            )}
          </div>
        </form>
      ) : (
        <form
          method="post"
          action="#"
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void sendOtp(e);
          }}
        >
          <p className="text-sm font-medium text-white/80">Continue with Phone</p>
          <div className="flex gap-2">
            <select
              className="h-11 rounded-xl border border-white/10 bg-white/5 px-2 text-sm text-white outline-none focus:border-[#FF6B9D]/50"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              aria-label="Country code"
              name="countryCode"
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.code} value={c.code} className="bg-[#12121A]">
                  {c.label}
                </option>
              ))}
            </select>
            <Input
              type="tel"
              name="phone"
              autoComplete="tel-national"
              inputMode="numeric"
              placeholder="Phone number"
              value={phoneLocal}
              onChange={(e) => setPhoneLocal(e.target.value)}
              className="h-11 flex-1 border-white/10 bg-white/5 text-white placeholder:text-white/30"
              disabled={loading}
            />
          </div>
          <Button
            type="submit"
            className="h-11 w-full gradient-primary border-0 font-medium"
            disabled={loading}
          >
            <Phone className="mr-2 h-4 w-4" />
            Send OTP
          </Button>
        </form>
      )}

      {showBecomeHost && intent === 'user' && (
        <div className="border-t border-white/8 pt-5 text-center">
          <Link
            href="/become-host"
            className="text-sm font-medium text-[#FF6B9D] transition-colors hover:text-[#FF8CB3]"
          >
            Become a Host
          </Link>
          <p className="mt-1 text-xs text-white/40">
            Earn money by receiving premium video calls
          </p>
        </div>
      )}
    </div>
  );
}
