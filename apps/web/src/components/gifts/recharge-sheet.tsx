'use client';

import Link from 'next/link';
import { Wallet, X, PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function RechargeSheet({
  open,
  onClose,
  balance,
  coinsPerMinute = 5,
  lowBalance = false,
  onEndCall,
}: {
  open: boolean;
  onClose: () => void;
  balance: number;
  coinsPerMinute?: number;
  lowBalance?: boolean;
  onEndCall?: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative rounded-t-[28px] bg-[#17171C] px-6 py-8 text-center shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-[#A7A7B3]"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <Wallet className="mx-auto h-12 w-12 text-[#FFB347]" />
        <h3 className="mt-4 text-xl font-bold text-white">
          {lowBalance ? 'Low Balance' : 'Need more coins?'}
        </h3>
        <p className="mt-2 text-sm text-[#A7A7B3]">
          Your balance is <span className="font-semibold text-[#FFB347]">{balance}</span> coins.
          {lowBalance && (
            <>
              {' '}
              You need at least <span className="text-white">{coinsPerMinute}</span> coins for the
              next minute.
            </>
          )}
        </p>
        <Button asChild variant="gradient" className="mt-6 w-full" onClick={onClose}>
          <Link href="/wallet/purchase">Recharge Now</Link>
        </Button>
        {onEndCall && (
          <Button
            variant="outline"
            className="mt-2 w-full border-red-500/30 text-red-400"
            onClick={() => {
              onClose();
              onEndCall();
            }}
          >
            <PhoneOff className="mr-2 h-4 w-4" />
            End Call
          </Button>
        )}
        {!lowBalance && (
          <Button variant="ghost" className="mt-2 w-full text-[#A7A7B3]" onClick={onClose}>
            Maybe later
          </Button>
        )}
      </div>
    </div>
  );
}