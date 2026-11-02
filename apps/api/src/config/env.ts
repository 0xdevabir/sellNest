import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');
const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v);
const optionalString = z.preprocess(emptyToUndefined, z.string().optional());

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().default(4100),
    WEB_URL: z.url(),
    CORS_ORIGINS: z.string().default(''),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    S3_ENDPOINT: optionalString,
    S3_REGION: z.string().default('auto'),
    S3_BUCKET: optionalString,
    S3_ACCESS_KEY_ID: optionalString,
    S3_SECRET_ACCESS_KEY: optionalString,
    S3_FORCE_PATH_STYLE: bool.default(false),
    S3_PUBLIC_URL: optionalString,
    SMTP_HOST: optionalString,
    SMTP_PORT: z.coerce.number().int().default(587),
    SMTP_USER: optionalString,
    SMTP_PASSWORD: optionalString,
    SMTP_SECURE: bool.default(false),
    MAIL_FROM: z.string().default('SellNest <no-reply@localhost>'),
    RUN_WORKER_IN_API: bool.default(true),
  })
  .superRefine((env, ctx) => {
    if (env.S3_BUCKET && (!env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY || !env.S3_PUBLIC_URL)) {
      ctx.addIssue({
        code: 'custom',
        path: ['S3_BUCKET'],
        message: 'S3_BUCKET also needs S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and S3_PUBLIC_URL',
      });
    }
    if (env.NODE_ENV === 'production') {
      if (!env.WEB_URL.startsWith('https://')) {
        ctx.addIssue({ code: 'custom', path: ['WEB_URL'], message: 'must use https in production' });
      }
      // Without email nobody can verify an account or reset a password, so refuse to start.
      if (!env.SMTP_HOST) {
        ctx.addIssue({ code: 'custom', path: ['SMTP_HOST'], message: 'is required in production' });
      }
    }
  });

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  loadDotenv({ path: resolve(__dirname, '../../../../.env'), quiet: true });
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  cached = parsed.data;
  return cached;
}

export function allowedOrigins(): string[] {
  const e = env();
  return [new URL(e.WEB_URL).origin, ...e.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)];
}
