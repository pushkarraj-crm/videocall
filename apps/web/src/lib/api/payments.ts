import { apiClient } from './client';
import type { CoinPackage } from '@/types/api';

export const paymentsApi = {
  getPackages: () =>
    apiClient<
      (CoinPackage & {
        mrpInr: string;
        totalCoins: number;
        discountPercent: number;
        isBestValue: boolean;
        isMostPopular: boolean;
        isLimitedOffer: boolean;
        sortOrder: number;
      })[]
    >('/payments/packages', { auth: false }),
  getRazorpayStatus: () =>
    apiClient<{
      configured: boolean;
      checkoutReady: boolean;
      webhookReady: boolean;
      keyIdPresent: boolean;
      keySecretPresent: boolean;
      webhookSecretPresent: boolean;
    }>('/payments/razorpay/status', { auth: false }),
  createOrder: (packageId: string) =>
    apiClient<{
      paymentId: string;
      razorpayOrderId: string;
      amountInr: string | number;
      totalInr: number;
      currency: string;
      keyId: string;
    }>('/payments/create-order', {
      method: 'POST',
      body: JSON.stringify({ packageId }),
    }),

  createCustomOrder: (customCoins: number) =>
    apiClient<{
      paymentId: string;
      razorpayOrderId: string;
      amountInr: number;
      totalInr: number;
      currency: string;
      keyId: string;
      coinUnitsCredited: string;
    }>('/payments/create-order', {
      method: 'POST',
      body: JSON.stringify({ customCoins }),
    }),

  confirm: (orderId: string, paymentId: string, signature: string) =>
    apiClient('/payments/confirm', {
      method: 'POST',
      body: JSON.stringify({ orderId, paymentId, signature }),
    }),
};