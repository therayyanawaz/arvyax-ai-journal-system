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

    const analysis = await this.aiRuntime.getActiveProvider().analyzeJournal(input.text);

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
