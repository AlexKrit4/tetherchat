import { z } from 'zod';
import './loadEnv.js';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),

  /** Public origin of the SPA, used for CORS, cookies and invite links. */
  PUBLIC_WEB_ORIGIN: z.string().default('http://localhost:5173'),
  PUBLIC_API_ORIGIN: z.string().default('http://localhost:4000'),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./uploads'),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('tetherchat'),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  /** Base URL files are served from, e.g. https://tetherchat.ru/files */
  S3_PUBLIC_URL: z.string().optional(),

  ENABLE_WORKERS: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  ENABLE_LINK_PREVIEWS: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),

  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:admin@tetherchat.ru'),

  /** Firebase service account JSON (raw or base64) for Android FCM. */
  FCM_SERVICE_ACCOUNT_JSON: z.string().optional(),
  FCM_PROJECT_ID: z.string().optional(),
  FCM_APPLICATION_ID: z.string().optional(),
  FCM_API_KEY: z.string().optional(),
  FCM_SENDER_ID: z.string().optional(),

  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default('TetherChat <no-reply@tetherchat.ru>'),

  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(600),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),
  MESSAGE_RATE_PER_10S: z.coerce.number().int().positive().default(30),

  /**
   * Free Groq OpenAI-compatible key for the built-in «Нейросеть» DM.
   * Create one at https://console.groq.com/keys — no card required.
   */
  GROQ_API_KEY: z.string().optional(),
  LLM_BASE_URL: z.string().default('https://api.groq.com/openai/v1'),
  LLM_MODEL: z.string().default('openai/gpt-oss-20b'),

  LIVEKIT_API_KEY: z.string().optional(),
  LIVEKIT_API_SECRET: z.string().optional(),
  LIVEKIT_URL: z.string().default('ws://localhost:7880'),
  PUBLIC_LIVEKIT_URL: z.string().default('ws://localhost:7880'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  /** Enigma VPN bot (Happ + Marzban + YooMoney) */
  VPN_BRAND_NAME: z.string().default('Enigma VPN'),
  VPN_SUBSCRIPTION_PREFIX: z.string().default('https://tetherchat.ru/api/vpn/s'),
  /** After YooMoney payment, redirect user here (Enigma site). */
  VPN_PAYMENT_SUCCESS_URL: z.string().default('https://bigwinzone.ru/dashboard?paid=1'),
  MARZBAN_URL: z.string().default('http://host.docker.internal:8000'),
  MARZBAN_USERNAME: z.string().default('admin'),
  MARZBAN_PASSWORD: z.string().default(''),
  MARZBAN_MOCK: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  YOOMONEY_WALLET: z.string().default(''),
  YOOMONEY_NOTIFICATION_SECRET: z.string().default(''),
  VPN_TRIAL_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  VPN_TRIAL_DURATION_DAYS: z.coerce.number().int().positive().default(1),
  VPN_TRIAL_TRAFFIC_GB: z.coerce.number().int().positive().default(5),
  VPN_TRIAL_DEVICE_LIMIT: z.coerce.number().int().positive().default(1),
  VPN_NODE_ID: z.string().default('nl-1'),
});

export type Config = z.infer<typeof schema>;

let cached: Config | null = null;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export function getConfig(): Config {
  cached ??= loadConfig();
  return cached;
}

export const isProduction = () => getConfig().NODE_ENV === 'production';
export const isTest = () => getConfig().NODE_ENV === 'test';
