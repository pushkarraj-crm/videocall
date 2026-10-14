export const DEV_AUTH_ENABLED =
  process.env.NODE_ENV === 'development' ||
  process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === 'true' ||
  process.env.NEXT_PUBLIC_ENABLE_DEV_AUTH === 'true';

export type AuthIntent = 'user' | 'host' | 'admin';

export const AUTH_INTENT_KEY = 'platform_auth_intent';