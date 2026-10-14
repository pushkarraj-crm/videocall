'use client';

import { useState } from 'react';
import { Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { GIFT_ITEMS } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface GiftPanelProps {
  balance: number;
  onSendGift: (giftId: string, coins: number) => Promise<void>;
  disabled?: boolean;
  sending?: boolean;
}

export function GiftPanel({ balance, onSendGift, disabled, sending }: GiftPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="h-12 w-12 rounded-full"
          disabled={disabled || sending}
          aria-label="Send gift"
        >
          <Gift className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Send a gift</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Balance: {balance} coins</p>
        {disabled && (
          <p className="text-sm text-muted-foreground">Gifts unlock once the call is active.</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          {GIFT_ITEMS.map((gift) => {
            const canAfford = balance >= gift.coins;
            return (
              <button
                key={gift.id}
                type="button"
                disabled={disabled || !canAfford || sending}
                onClick={async () => {
                  await onSendGift(gift.id, gift.coins);
                  setOpen(false);
                }}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors',
                  canAfford
                    ? 'border-border hover:border-primary hover:bg-primary/5'
                    : 'cursor-not-allowed opacity-50',
                )}
              >
                <span className="text-3xl">{gift.emoji}</span>
                <span className="text-sm font-medium">{gift.name}</span>
                <span className="text-xs text-muted-foreground">{gift.coins} coins</span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}