import OpenAI from 'openai';
import { z } from 'zod';

import { env, hasLlmConfig } from '../config/env.js';
import { JournalRepository } from '../repositories/journalRepository.js';
import {
  BadRequestError,
  InternalServerError,
  NotFoundError,
} from '../utils/appError.js';
import { hashText } from '../utils/hash.js';
import type { AnalysisResponse } from '../types/journal.js';

const llmResponseSchema = z.object({
  emotion: z.string().trim().min(1),
  keywords: z.array(z.string().trim().min(1)).min(1),
  summary: z.string().trim().min(1)
});

type AnalyzeInput = {
  text: string;
  journalEntryId?: string;
};

export class AnalysisService {
  constructor(private readonly repository: JournalRepository) {}

  async analyze(input: AnalyzeInput): Promise<AnalysisResponse> {
    const textHash = hashText(input.text);

    if (input.journalEntryId) {
      const existing = await this.repository.getAnalysisByEntryId(input.journalEntryId);
      if (existing) {
        return this.toResponse(existing);
      }

      const entry = await this.repository.getEntryById(input.journalEntryId);
      if (!entry) {
        throw new NotFoundError('Journal entry was not found.', 'ENTRY_NOT_FOUND');
      }

      if (entry.text !== input.text) {
        throw new BadRequestError('Journal text does not match the selected entry.');
      }
    }

    const cached = await this.repository.getCachedAnalysis(textHash);
    if (cached) {
      if (input.journalEntryId) {
        const linked = await this.repository.createAnalysis({
          journalEntryId: input.journalEntryId,
          emotion: cached.emotion,
          keywordsJson: cached.keywordsJson,
          summary: cached.summary,
          textHash
        });

        return this.toResponse(linked);
      }

      return this.toResponse(cached);
    }

    if (!hasLlmConfig()) {
      throw new InternalServerError(
        'LLM configuration is missing. Set OPENAI_API_KEY, OPENAI_BASE_URL, and LLM_MODEL.',
        'LLM_UNAVAILABLE'
      );
    }

    const analysis = await this.requestAnalysisFromLlm(input.text);

    if (!input.journalEntryId) {
      const created = await this.repository.createAnalysis({
        emotion: analysis.emotion,
        keywordsJson: JSON.stringify(analysis.keywords),
        summary: analysis.summary,
        textHash
      });

      return this.toResponse(created);
    }

    const created = await this.repository.createAnalysis({
      journalEntryId: input.journalEntryId,
      emotion: analysis.emotion,
      keywordsJson: JSON.stringify(analysis.keywords),
      summary: analysis.summary,
      textHash
    });

    return this.toResponse(created);
  }

  private async requestAnalysisFromLlm(text: string) {
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
              'You analyze reflective journal entries. Return strict JSON with keys emotion, keywords, summary. emotion must be a short string. keywords must be an array of 3 to 6 concise lowercase terms. summary must be 1 short sentence. No markdown.'
          },
          {
            role: 'user',
            content: `Analyze this journal entry and return only JSON:\n${text}`
          }
        ]
      });

      const message = completion.choices[0]?.message?.content;
      if (typeof message !== 'string' || message.trim().length === 0) {
        throw new InternalServerError('LLM returned an empty response.', 'LLM_RESPONSE_INVALID');
      }

      const parsed = llmResponseSchema.parse(JSON.parse(message));
      return {
        emotion: parsed.emotion.trim(),
        keywords: Array.from(
          new Set(parsed.keywords.map((keyword) => keyword.trim().toLowerCase()).filter(Boolean))
        ),
        summary: parsed.summary.trim()
      };
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

  private toResponse(analysis: {
    emotion: string;
    keywordsJson: string;
    summary: string;
    textHash: string;
  }): AnalysisResponse {
    return {
      emotion: analysis.emotion,
      keywords: JSON.parse(analysis.keywordsJson) as string[],
      summary: analysis.summary
    };
  }
}
