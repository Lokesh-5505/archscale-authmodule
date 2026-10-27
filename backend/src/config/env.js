import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/archscale_auth'),
  SUPABASE_URL: z.string().url().default('https://placeholder-project.supabase.co'),
  SUPABASE_ANON_KEY: z.string().default('placeholder-anon-key'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default('placeholder-service-role-key'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  COOKIE_SECRET: z.string().default('archscale_development_cookie_secret_key_32chars!'),
  OTP_ENCRYPTION_KEY: z.string().default('archscale_development_otp_encryption_key_32c!'),
  MAIL_PROVIDER: z.enum(['resend', 'smtp', 'console', 'auto']).default('auto'),
  MAIL_PROVIDER_KEY: z.string().optional().default(''),
  MAIL_FROM: z.string().default('ArchScale<onboarding@resend.dev>'),
  SMTP_SERVICE: z.string().optional().default(''),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.string().optional().default('587').transform((val) => parseInt(val, 10)),
  SMTP_SECURE: z.string().optional().default('false').transform((val) => val === 'true'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SEED_SUPER_ADMIN_EMAIL: z.string().email().default('superadmin@archscale.in'),
  SEED_ADMIN_EMAIL: z.string().email().default('admin@archscale.in'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Environment validation failed:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
