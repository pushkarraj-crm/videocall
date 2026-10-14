'use client';

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color: string };
  modal?: { ondismiss: () => void };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, cb: () => void) => void;
}

export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export async function openRazorpayCheckout(options: {
  keyId: string;
  orderId: string;
  amountInr: number;
  name: string;
  description: string;
  onSuccess: (paymentId: string, orderId: string, signature: string) => void;
  onDismiss?: () => void;
}) {
  const loaded = await loadRazorpayScript();
  if (!loaded || !window.Razorpay) {
    throw new Error('Failed to load Razorpay');
  }

  const rzp = new window.Razorpay({
    key: options.keyId,
    amount: Math.round(options.amountInr * 100),
    currency: 'INR',
    name: options.name,
    description: options.description,
    order_id: options.orderId,
    handler: (res) => {
      options.onSuccess(res.razorpay_payment_id, res.razorpay_order_id, res.razorpay_signature);
    },
    theme: { color: '#6366f1' },
    modal: { ondismiss: () => options.onDismiss?.() },
  });

  rzp.open();
}