'use client';

import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function SuccessState({
  title,
  message,
  action,
  className,
}: {
  title: string;
  message?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'animate-fade-in flex min-h-[40vh] flex-col items-center justify-center gap-4 p-6 text-center',
        className,
      )}
    >
      <div className="relative">
        <div className="absolute inset-0 animate-pulse-ring rounded-full bg-emerald-500/20" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30">
          <CheckCircle2 className="h-8 w-8 text-emerald-400" aria-hidden />
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {message && <p className="mt-1 max-w-sm text-sm text-[#A7A7B3]">{message}</p>}
      </div>
      {action}
    </div>
  );
}

export function SuccessAction({
  children,
  onClick,
  href,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  if (href) {
    return (
      <Button className="gradient-primary border-0" asChild>
        <a href={href}>{children}</a>
      </Button>
    );
  }
  return (
    <Button className="gradient-primary border-0" onClick={onClick}>
      {children}
    </Button>
  );
}