import { z } from 'zod';

const ambienceSchema = z
  .string()
  .trim()
  .transform((value) => value.toLowerCase())
  .pipe(z.enum(['forest', 'ocean', 'mountain']));

const textSchema = z.string().trim().min(5).max(5000);

export const createJournalSchema = z.object({
  userId: z.string().trim().min(1).max(100),
  ambience: ambienceSchema,
  text: textSchema
});

export const analyzeJournalSchema = z.object({
  journalEntryId: z.string().trim().min(1).optional(),
  text: textSchema
});

export const userIdParamSchema = z.object({
  userId: z.string().trim().min(1)
});
