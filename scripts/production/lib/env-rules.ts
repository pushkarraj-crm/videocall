export type EnvRule = {
  key: string;
  required?: boolean;
  minLength?: number;
  pattern?: RegExp;
  forbiddenValues?: string[];
  productionOnly?: boolean;
};

export const PRODUCTION_REQUIRED: EnvRule[] = [
  { key: 'DOMAIN_NAME', required: true, minLength: 3 },
  { key: 'API_DOMAIN', required: true, minLength: 3 },
  { key: 'ADMIN_DOMAIN', required: true, minLength: 3 },
  { key: 'POSTGRES_PASSWORD', required: true, minLength: 16 },
  { key: 'DATABASE_URL', required: true, pattern: /^postgresql:\/\// },
  { key: 'JWT_SECRET', required: true, minLength: 32, forbiddenValues: ['change-me-to-a-long-random-secret-min-32-chars', 'change-me-to-a-long-random-secret-min-64-chars'] },
  { key: 'CORS_ORIGINS', required: true, pattern: /^https:\/\// },
  { key: 'ENABLE_DEV_AUTH', required: true, forbiddenValues: ['true'] },
  { key: 'FIREBASE_PROJECT_ID', required: true, minLength: 1 },
  { key: 'ZEGO_APP_ID', required: true, minLength: 1 },
  { key: 'ZEGO_SERVER_SECRET', required: true, minLength: 32 },
  { key: 'RAZORPAY_KEY_ID', required: true, minLength: 1 },
  { key: 'RAZORPAY_KEY_SECRET', required: true, minLength: 1 },
  { key: 'RAZORPAY_WEBHOOK_SECRET', required: true, minLength: 16, forbiddenValues: ['change-me-webhook-secret'] },
  { key: 'COMMUNICATIONS_INTERNAL_API_KEY', required: true, minLength: 16, forbiddenValues: ['dev-internal-communications-key', 'change-me-internal-key'] },
  { key: 'NEXT_PUBLIC_API_URL', required: true, pattern: /^https:\/\// },
  { key: 'NEXT_PUBLIC_ENABLE_DEV_AUTH', required: true, forbiddenValues: ['true'] },
  { key: 'REDIS_URL', required: true, pattern: /^redis:\/\// },
  { key: 'STORAGE_PROVIDER', required: true },
  { key: 'LETSENCRYPT_EMAIL', required: true, pattern: /@/ },
];

export const STAGING_REQUIRED: EnvRule[] = PRODUCTION_REQUIRED.map((rule) => {
  if (rule.key === 'JWT_SECRET') {
    return { ...rule, minLength: 32 };
  }
  if (rule.key === 'CORS_ORIGINS') {
    return { ...rule, pattern: /^https:\/\// };
  }
  return rule;
});

export function parseEnvFile(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function validateEnvMap(
  env: Record<string, string>,
  rules: EnvRule[],
  label: string,
): string[] {
  const errors: string[] = [];

  for (const rule of rules) {
    const value = env[rule.key]?.trim() ?? '';

    if (rule.required && !value) {
      errors.push(`${label}: missing ${rule.key}`);
      continue;
    }

    if (!value) continue;

    if (rule.minLength && value.length < rule.minLength) {
      errors.push(`${label}: ${rule.key} must be at least ${rule.minLength} chars`);
    }

    if (rule.pattern && !rule.pattern.test(value)) {
      errors.push(`${label}: ${rule.key} failed pattern check`);
    }

    if (rule.forbiddenValues?.includes(value)) {
      errors.push(`${label}: ${rule.key} uses placeholder value — set a real secret`);
    }
  }

  return errors;
}