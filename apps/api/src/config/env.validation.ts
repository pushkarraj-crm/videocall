import { plainToInstance, Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsIn(['development', 'production', 'test'])
  @IsOptional()
  NODE_ENV: string = 'development';

  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  @Min(1)
  PORT: number = 3001;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET!: string;

  @IsString()
  JWT_EXPIRES_IN!: string;

  @IsString()
  @IsOptional()
  API_PREFIX?: string;

  @IsString()
  @IsOptional()
  CORS_ORIGINS?: string;

  @IsString()
  @IsOptional()
  FIREBASE_PROJECT_ID?: string;

  @IsString()
  @IsOptional()
  FIREBASE_CLIENT_EMAIL?: string;

  @IsString()
  @IsOptional()
  FIREBASE_PRIVATE_KEY?: string;

  @IsString()
  @IsOptional()
  ZEGO_APP_ID?: string;

  @IsString()
  @IsOptional()
  ZEGO_SERVER_SECRET?: string;
  /** When "false", mint identity-only Token04 (empty payload). Default: room privilege payload. */
  ZEGO_TOKEN_ROOM_PRIVILEGE?: string;

  @IsString()
  @IsOptional()
  RAZORPAY_KEY_ID?: string;

  @IsString()
  @IsOptional()
  RAZORPAY_KEY_SECRET?: string;

  @IsString()
  @IsOptional()
  RAZORPAY_WEBHOOK_SECRET?: string;

  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsNumber()
  @IsOptional()
  PLATFORM_FEE_PERCENT?: number;

  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsNumber()
  @IsOptional()
  COINS_PER_MINUTE_UNITS?: number;

  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsNumber()
  @IsOptional()
  SIGNUP_BONUS_COINS?: number;

  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsNumber()
  @IsOptional()
  JWT_REFRESH_EXPIRES_DAYS?: number;

  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsNumber()
  @IsOptional()
  FREE_CALL_LIMIT?: number;

  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsNumber()
  @IsOptional()
  FREE_CALL_MAX_SECONDS?: number;

  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsNumber()
  @IsOptional()
  REFERRAL_REWARD_UNITS?: number;

  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsNumber()
  @IsOptional()
  WITHDRAWAL_MIN_UNITS?: number;

  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsNumber()
  @IsOptional()
  WITHDRAWAL_HOLD_DAYS?: number;

  @IsString()
  @IsOptional()
  ENABLE_DEV_AUTH?: string;

  @IsIn(['console', 'smtp', 'sendgrid', 'resend'])
  @IsOptional()
  EMAIL_PROVIDER?: string;

  @IsIn(['console', 'twilio', 'msg91', 'textlocal'])
  @IsOptional()
  SMS_PROVIDER?: string;

  @IsIn(['console', 'smtp', 'sendgrid', 'resend'])
  @IsOptional()
  EMAIL_PROVIDER_FALLBACK?: string;

  @IsIn(['console', 'twilio', 'msg91', 'textlocal'])
  @IsOptional()
  SMS_PROVIDER_FALLBACK?: string;

  @IsString()
  @IsOptional()
  EMAIL_FROM?: string;

  @IsString()
  @IsOptional()
  SMTP_HOST?: string;

  @IsString()
  @IsOptional()
  SMTP_PORT?: string;

  @IsString()
  @IsOptional()
  SMTP_USER?: string;

  @IsString()
  @IsOptional()
  SMTP_PASS?: string;

  @IsString()
  @IsOptional()
  SENDGRID_API_KEY?: string;

  @IsString()
  @IsOptional()
  RESEND_API_KEY?: string;

  @IsString()
  @IsOptional()
  TWILIO_ACCOUNT_SID?: string;

  @IsString()
  @IsOptional()
  TWILIO_AUTH_TOKEN?: string;

  @IsString()
  @IsOptional()
  TWILIO_FROM_NUMBER?: string;

  @IsString()
  @IsOptional()
  MSG91_AUTH_KEY?: string;

  @IsString()
  @IsOptional()
  MSG91_SENDER_ID?: string;

  @IsString()
  @IsOptional()
  MSG91_ROUTE?: string;

  @IsString()
  @IsOptional()
  TEXTLOCAL_API_KEY?: string;

  @IsString()
  @IsOptional()
  TEXTLOCAL_SENDER?: string;

  @IsString()
  @IsOptional()
  COMMUNICATIONS_INTERNAL_API_KEY?: string;

  @IsString()
  @IsOptional()
  REDIS_URL?: string;

  @IsIn(['local', 'openai'])
  @IsOptional()
  AI_CONVERSATION_PROVIDER?: string;

  @IsIn(['local', 'openai', 'elevenlabs', 'cartesia'])
  @IsOptional()
  AI_VOICE_PROVIDER?: string;

  @IsString()
  @IsOptional()
  ELEVENLABS_API_KEY?: string;

  @IsString()
  @IsOptional()
  CARTESIA_API_KEY?: string;

  @IsString()
  @IsOptional()
  OPENAI_API_KEY?: string;

  @IsString()
  @IsOptional()
  OPENAI_MODEL?: string;

  @IsString()
  @IsOptional()
  SENTRY_DSN?: string;

  @IsString()
  @IsOptional()
  SENTRY_ENVIRONMENT?: string;

  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsNumber()
  @IsOptional()
  SENTRY_TRACES_SAMPLE_RATE?: number;

  @IsIn(['local', 's3', 'r2'])
  @IsOptional()
  STORAGE_PROVIDER?: string;

  @IsString()
  @IsOptional()
  STORAGE_BUCKET?: string;

  @IsString()
  @IsOptional()
  STORAGE_ENDPOINT?: string;

  @IsString()
  @IsOptional()
  STORAGE_REGION?: string;

  @IsString()
  @IsOptional()
  STORAGE_ACCESS_KEY?: string;

  @IsString()
  @IsOptional()
  STORAGE_SECRET_KEY?: string;

  @IsString()
  @IsOptional()
  STORAGE_LOCAL_PATH?: string;

  @IsString()
  @IsOptional()
  ENABLE_CRON_JOBS?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.toString()}`);
  }

  if (validated.NODE_ENV === 'production') {
    const required: Array<[keyof EnvironmentVariables, string]> = [
      ['JWT_SECRET', 'JWT_SECRET'],
      ['DATABASE_URL', 'DATABASE_URL'],
      ['REDIS_URL', 'REDIS_URL'],
      ['CORS_ORIGINS', 'CORS_ORIGINS'],
      ['FIREBASE_PROJECT_ID', 'FIREBASE_PROJECT_ID'],
      ['ZEGO_APP_ID', 'ZEGO_APP_ID'],
      ['ZEGO_SERVER_SECRET', 'ZEGO_SERVER_SECRET'],
      ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_ID'],
      ['RAZORPAY_KEY_SECRET', 'RAZORPAY_KEY_SECRET'],
      ['RAZORPAY_WEBHOOK_SECRET', 'RAZORPAY_WEBHOOK_SECRET'],
      ['COMMUNICATIONS_INTERNAL_API_KEY', 'COMMUNICATIONS_INTERNAL_API_KEY'],
    ];
    const missing = required
      .filter(([key]) => !validated[key] || validated[key] === 'change-me-to-a-long-random-secret-min-32-chars')
      .map(([, label]) => label);
    if (validated.ENABLE_DEV_AUTH === 'true') {
      missing.push('ENABLE_DEV_AUTH must be false in production');
    }
    if (missing.length > 0) {
      throw new Error(`Production environment missing or invalid: ${missing.join(', ')}`);
    }
  }

  return validated;
}
