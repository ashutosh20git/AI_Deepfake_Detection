import { z } from 'zod';

const boolFromEnv = z.preprocess((value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return false;
}, z.boolean());

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(32),
    ML_SERVICE_URL: z.string().url(),
    GEMINI_API_KEY: z.string().min(20),
    HCAPTCHA_SECRET: z.string().min(1),
    PORT: z.coerce.number().int().positive().default(3000),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    OFFLINE_MODE: boolFromEnv.default(false),
    FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional(),
    ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  })
  .superRefine((data, ctx) => {
    if (!data.OFFLINE_MODE && !data.FIREBASE_SERVICE_ACCOUNT_PATH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['FIREBASE_SERVICE_ACCOUNT_PATH'],
        message: 'FIREBASE_SERVICE_ACCOUNT_PATH is required when OFFLINE_MODE=false',
      });
    }
  });

export const validateEnv = (env) => envSchema.parse(env);
