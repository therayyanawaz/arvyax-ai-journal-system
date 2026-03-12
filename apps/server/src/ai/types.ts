import { z } from 'zod';

import type { AnalysisResponse } from '../types/journal.js';

export const aiProviderNameSchema = z.enum(['openaiApi', 'codexChatgpt']);

export type AiProviderName = z.infer<typeof aiProviderNameSchema>;

export const aiProviderSelectionSchema = z.object({
  provider: aiProviderNameSchema
});

export type AiProviderSelectionInput = z.infer<typeof aiProviderSelectionSchema>;

export type AiProviderHealth = {
  available: boolean;
  ready: boolean;
  reason: string | null;
};

export type AiProviderStatus = AiProviderHealth & {
  name: AiProviderName;
  label: string;
  selected: boolean;
};

export interface AiProvider {
  readonly name: AiProviderName;
  readonly label: string;
  analyzeJournal(text: string): Promise<AnalysisResponse>;
  getHealth(): Promise<AiProviderHealth>;
}

export interface AiProviderRuntime {
  getActiveProvider(): AiProvider;
  getActiveProviderName(): AiProviderName;
  listProviders(): Promise<AiProviderStatus[]>;
  setActiveProvider(name: AiProviderName): Promise<AiProviderStatus[]>;
}

const aiAnalysisSchema = z.object({
  emotion: z.string().trim().min(1),
  keywords: z.array(z.string().trim().min(1)).min(1),
  summary: z.string().trim().min(1)
});

export function buildJournalAnalysisPrompt(text: string) {
  return [
    'You are analyzing a reflective journal entry after an immersive nature session.',
    'Return ONLY valid JSON.',
    'Do not include markdown.',
    'Do not include code fences.',
    'Do not include commentary before or after the JSON.',
    'Use this exact schema:',
    '{',
    '  "emotion": "string",',
    '  "keywords": ["string"],',
    '  "summary": "string"',
    '}',
    'Requirements:',
    '- emotion: one concise emotion label',
    '- keywords: 3 to 7 concise lowercase keywords',
    '- summary: one short sentence',
    '',
    'Journal entry:',
    text.trim()
  ].join('\n');
}

export function extractJsonObjectText(value: string) {
  const trimmed = value.trim();
  const withoutFenceStart = trimmed.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const firstBrace = withoutFenceStart.indexOf('{');
  const lastBrace = withoutFenceStart.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    return withoutFenceStart;
  }

  return withoutFenceStart.slice(firstBrace, lastBrace + 1);
}

export function normalizeAnalysisResponse(value: unknown): AnalysisResponse {
  const parsed = aiAnalysisSchema.parse(value);
  const keywords = Array.from(
    new Set(parsed.keywords.map((keyword) => keyword.trim().toLowerCase()).filter(Boolean))
  ).slice(0, 7);

  if (keywords.length === 0) {
    throw new Error('Analysis keywords could not be normalized.');
  }

  return {
    emotion: parsed.emotion.trim(),
    keywords,
    summary: parsed.summary.trim()
  };
}
