export interface RiskRuleConfig {
  id: string;
  weight: number;
  enabled: boolean;
}

export const DEFAULT_RISK_RULES: RiskRuleConfig[] = [
  { id: 'multi_account_device', weight: 35, enabled: true },
  { id: 'multi_account_ip', weight: 30, enabled: true },
  { id: 'disposable_email', weight: 25, enabled: true },
  { id: 'rapid_signup_ip', weight: 40, enabled: true },
  { id: 'country_switch', weight: 30, enabled: true },
  { id: 'impossible_travel', weight: 45, enabled: true },
  { id: 'referral_self', weight: 100, enabled: true },
  { id: 'referral_same_device', weight: 50, enabled: true },
  { id: 'referral_same_ip', weight: 35, enabled: true },
  { id: 'referral_farming', weight: 40, enabled: true },
  { id: 'coupon_multi_account', weight: 45, enabled: true },
  { id: 'coupon_rapid_attempts', weight: 35, enabled: true },
  { id: 'payment_failed_burst', weight: 30, enabled: true },
  { id: 'recharge_spike', weight: 40, enabled: true },
  { id: 'withdrawal_burst', weight: 35, enabled: true },
  { id: 'withdrawal_after_recharge', weight: 50, enabled: true },
  { id: 'duplicate_kyc_doc', weight: 55, enabled: true },
  { id: 'short_call_farming', weight: 30, enabled: true },
  { id: 'call_frequency_bot', weight: 40, enabled: true },
];