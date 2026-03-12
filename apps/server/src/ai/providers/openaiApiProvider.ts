import OpenAI from 'openai';
import { z } from 'zod';

import { env, hasOpenAiConfig } from '../../config/env.js';
import { InternalServerError } from '../../utils/appError.js';
import {
  buildJournalAnalysisPrompt,
  extractJsonObjectText,
  normalizeAnalysisResponse,
  type AiProvider
} from '../types.js';

export class OpenAiApiProvider implements AiProvider {
  readonly name = 'openaiApi' as const;
  readonly label = 'OpenAI API';

  async getHealth() {
    return {
      available: true,
      ready: hasOpenAiConfig(),
      reason: hasOpenAiConfig()
        ? null
        : 'Set OPENAI_API_KEY, OPENAI_BASE_URL, and LLM_MODEL on the backend to use OpenAI API mode.'
    };
  }

  async analyzeJournal(text: string) {
    if (!hasOpenAiConfig()) {
      throw new InternalServerError(
        'LLM configuration is missing. Set OPENAI_API_KEY, OPENAI_BASE_URL, and LLM_MODEL.',
        'LLM_UNAVAILABLE'
      );
    }

    try {
      const client = new OpenAI({
        apiKey: env.OPENAI_API_KEY,
        baseURL: env.OPENAI_BASE_URL
      });

      const completion = await client.chat.completions.create({
        model: env.LLM_MODEL!,
        temperature: 0.2,
        response_format: {
          type: 'json_object'
        },
        messages: [
          {
            role: 'system',
            content:
              'You analyze reflective journal entries and must return strict JSON only.'
          },
          {
            role: 'user',
            content: buildJournalAnalysisPrompt(text)
          }
        ]
      });

      const message = completion.choices[0]?.message?.content;
      if (typeof message !== 'string' || message.trim().length === 0) {
        throw new InternalServerError('LLM returned an empty response.', 'LLM_RESPONSE_INVALID');
      }

      return normalizeAnalysisResponse(JSON.parse(extractJsonObjectText(message)));
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof z.ZodError) {
        throw new InternalServerError('LLM returned invalid JSON.', 'LLM_RESPONSE_INVALID');
      }

      if (error instanceof InternalServerError) {
        throw error;
      }

      throw new InternalServerError('LLM request failed.', 'LLM_REQUEST_FAILED');
    }
  }
}
