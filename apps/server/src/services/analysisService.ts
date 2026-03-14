import type { JournalAnalysis } from '@prisma/client';

import type { AiProviderRuntime } from '../ai/types.js';
import { JournalRepository } from '../repositories/journalRepository.js';
import {
  BadRequestError,
  NotFoundError,
} from '../utils/appError.js';
import { hashText } from '../utils/hash.js';
import type { AnalysisResponse } from '../types/journal.js';

type AnalyzeInput = {
  text: string;
  journalEntryId?: string;
};

export class AnalysisService {
  private readonly inFlightCachedAnalyses = new Map<string, Promise<JournalAnalysis>>();

  constructor(
    private readonly repository: JournalRepository,
    private readonly aiRuntime: AiProviderRuntime
  ) {}

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

    const cached = await this.ensureCachedAnalysis(textHash, input.text);
    if (!input.journalEntryId) {
      return this.toResponse(cached);
    }

    const created = await this.repository.createAnalysisForEntryOrGetExisting({
      journalEntryId: input.journalEntryId,
      emotion: cached.emotion,
      keywordsJson: cached.keywordsJson,
      summary: cached.summary,
      textHash
    });

    return this.toResponse(created);
  }

  private async ensureCachedAnalysis(textHash: string, text: string): Promise<JournalAnalysis> {
    const cached = await this.repository.getCachedAnalysis(textHash);
    if (cached) {
      return cached;
    }

    const inFlight = this.inFlightCachedAnalyses.get(textHash);
    if (inFlight) {
      return inFlight;
    }

    const analysisPromise = (async () => {
      const existing = await this.repository.getCachedAnalysis(textHash);
      if (existing) {
        return existing;
      }

      const analysis = await this.aiRuntime.getActiveProvider().analyzeJournal(text);
      return this.repository.createAnalysis({
        emotion: analysis.emotion,
        keywordsJson: JSON.stringify(analysis.keywords),
        summary: analysis.summary,
        textHash
      });
    })();

    this.inFlightCachedAnalyses.set(textHash, analysisPromise);

    try {
      return await analysisPromise;
    } finally {
      if (this.inFlightCachedAnalyses.get(textHash) === analysisPromise) {
        this.inFlightCachedAnalyses.delete(textHash);
      }
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
