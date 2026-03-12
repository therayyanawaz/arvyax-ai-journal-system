import { z } from 'zod';

import type { AnalysisResponse } from '../../types/journal.js';

export const codexAuthModeSchema = z.enum(['apikey', 'chatgpt', 'chatgptAuthTokens']);
export type CodexAuthMode = z.infer<typeof codexAuthModeSchema>;

export const codexPlanTypeSchema = z.enum([
  'free',
  'go',
  'plus',
  'pro',
  'team',
  'business',
  'enterprise',
  'edu',
  'unknown'
]);
export type CodexPlanType = z.infer<typeof codexPlanTypeSchema>;

export const codexAccountSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('apiKey')
  }),
  z.object({
    type: z.literal('chatgpt'),
    email: z.string().trim().email(),
    planType: codexPlanTypeSchema
  })
]);
export type CodexAccount = z.infer<typeof codexAccountSchema>;

const codexRateLimitWindowSchema = z.object({
  usedPercent: z.number().nullable().optional(),
  windowDurationMins: z.number().nullable().optional(),
  resetsAt: z.number().nullable().optional()
});

export const codexRateLimitSnapshotSchema = z.object({
  limitId: z.string().nullable().optional(),
  limitName: z.string().nullable().optional(),
  primary: codexRateLimitWindowSchema.nullable().optional(),
  secondary: codexRateLimitWindowSchema.nullable().optional(),
  credits: z.unknown().nullable().optional(),
  planType: codexPlanTypeSchema.nullable().optional()
});
export type CodexRateLimitSnapshot = z.infer<typeof codexRateLimitSnapshotSchema>;

export const codexAccountReadResponseSchema = z.object({
  account: codexAccountSchema.nullable(),
  requiresOpenaiAuth: z.boolean()
});
export type CodexAccountReadResponse = z.infer<typeof codexAccountReadResponseSchema>;

export const codexAccountUpdatedNotificationSchema = z.object({
  authMode: codexAuthModeSchema.nullable(),
  planType: codexPlanTypeSchema.nullable()
});
export type CodexAccountUpdatedNotification = z.infer<
  typeof codexAccountUpdatedNotificationSchema
>;

export const codexAccountLoginCompletedNotificationSchema = z.object({
  loginId: z.string().nullable(),
  success: z.boolean(),
  error: z.string().nullable()
});
export type CodexAccountLoginCompletedNotification = z.infer<
  typeof codexAccountLoginCompletedNotificationSchema
>;

export const codexAccountRateLimitsResponseSchema = z.object({
  rateLimits: codexRateLimitSnapshotSchema,
  rateLimitsByLimitId: z.record(z.string(), codexRateLimitSnapshotSchema).nullable().optional()
});
export type CodexAccountRateLimitsResponse = z.infer<typeof codexAccountRateLimitsResponseSchema>;

export const codexLoginAccountResponseSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('apiKey')
  }),
  z.object({
    type: z.literal('chatgpt'),
    loginId: z.string(),
    authUrl: z.string().url()
  }),
  z.object({
    type: z.literal('chatgptAuthTokens')
  })
]);
export type CodexLoginAccountResponse = z.infer<typeof codexLoginAccountResponseSchema>;

export const codexThreadStartResponseSchema = z.object({
  thread: z.object({
    id: z.string()
  }),
  model: z.string().optional(),
  modelProvider: z.string().optional()
});
export type CodexThreadStartResponse = z.infer<typeof codexThreadStartResponseSchema>;

export const codexTurnStartResponseSchema = z.object({
  turn: z.object({
    id: z.string(),
    status: z.string(),
    error: z
      .object({
        message: z.string().optional()
      })
      .nullable()
      .optional()
  })
});
export type CodexTurnStartResponse = z.infer<typeof codexTurnStartResponseSchema>;

export const codexTurnCompletedNotificationSchema = z.object({
  threadId: z.string(),
  turn: z.object({
    id: z.string(),
    status: z.string(),
    error: z
      .object({
        message: z.string().optional()
      })
      .nullable()
      .optional()
  })
});
export type CodexTurnCompletedNotification = z.infer<typeof codexTurnCompletedNotificationSchema>;

export const codexItemCompletedNotificationSchema = z.object({
  threadId: z.string(),
  turnId: z.string(),
  item: z.object({ type: z.string() }).passthrough()
});
export type CodexItemCompletedNotification = z.infer<typeof codexItemCompletedNotificationSchema>;

export const codexThreadReadResponseSchema = z.object({
  thread: z.object({
    turns: z.array(
      z.object({
        id: z.string(),
        items: z.array(z.object({ type: z.string() }).passthrough())
      })
    )
  })
});
export type CodexThreadReadResponse = z.infer<typeof codexThreadReadResponseSchema>;

export const codexAvailabilitySchema = z.object({
  enabled: z.boolean(),
  available: z.boolean(),
  reason: z.string().nullable()
});
export type CodexAvailability = z.infer<typeof codexAvailabilitySchema>;

export const codexLoginStatusSchema = z.object({
  loginId: z.string(),
  status: z.enum(['pending', 'success', 'error']),
  error: z.string().nullable(),
  authUrl: z.string().url().nullable()
});
export type CodexLoginStatus = z.infer<typeof codexLoginStatusSchema>;

export const codexAccountStatusSchema = z.object({
  enabled: z.boolean(),
  available: z.boolean(),
  ready: z.boolean(),
  authStatus: z.enum(['unavailable', 'signed-out', 'signing-in', 'signed-in', 'error']),
  authMode: codexAuthModeSchema.nullable(),
  email: z.string().nullable(),
  planType: codexPlanTypeSchema.nullable(),
  requiresOpenaiAuth: z.boolean().nullable(),
  rateLimits: codexRateLimitSnapshotSchema.nullable(),
  availabilityReason: z.string().nullable(),
  activeLoginId: z.string().nullable()
});
export type CodexAccountStatus = z.infer<typeof codexAccountStatusSchema>;

export interface CodexAppServerAdapter {
  getAvailability(): Promise<CodexAvailability>;
  getAccountStatus(refreshToken?: boolean): Promise<CodexAccountStatus>;
  startChatGptLogin(): Promise<{ loginId: string; authUrl: string }>;
  getLoginStatus(loginId: string): Promise<CodexLoginStatus | null>;
  logout(): Promise<void>;
  analyzeJournal(text: string): Promise<AnalysisResponse>;
}
