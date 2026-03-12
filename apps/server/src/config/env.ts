import { z } from 'zod';

const optionalTrimmedString = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}, z.string().min(1).optional());

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(4000),
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

export const env = envSchema.parse(process.env);

export function hasLlmConfig() {
  return Boolean(env.OPENAI_API_KEY && env.OPENAI_BASE_URL && env.LLM_MODEL);
}
