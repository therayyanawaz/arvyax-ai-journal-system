import { z } from 'zod';

import { aiProviderNameSchema } from '../ai/types.js';

export const aiProviderSelectionSchema = z.object({
  provider: aiProviderNameSchema
});

export const loginIdParamSchema = z.object({
  loginId: z.string().trim().min(1)
});
