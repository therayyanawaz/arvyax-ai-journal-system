import { z } from 'zod';

import { aiProviderNameSchema } from '../ai/types.js';

const optionalTrimmedString = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}, z.string().min(1).optional());

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }

  return value;
}, z.boolean());

const stringArrayFromEnv = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}, z.array(z.string()));

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CORS_ALLOWED_ORIGINS: stringArrayFromEnv.default([]),
  AI_PROVIDER: aiProviderNameSchema.default('openaiApi'),
  CODEX_PROVIDER_ENABLED: booleanFromEnv.default(false),
  OPENAI_API_KEY: optionalTrimmedString,
  OPENAI_BASE_URL: z.preprocess((value) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }, z.string().url().optional()),
  LLM_MODEL: optionalTrimmedString
});

export type ServerEnv = z.infer<typeof envSchema>;

export const env: ServerEnv = envSchema.parse(process.env);

export function hasOpenAiConfig(
  currentEnv: Pick<ServerEnv, 'OPENAI_API_KEY' | 'OPENAI_BASE_URL' | 'LLM_MODEL'> = env
) {
  return Boolean(currentEnv.OPENAI_API_KEY && currentEnv.OPENAI_BASE_URL && currentEnv.LLM_MODEL);
}
