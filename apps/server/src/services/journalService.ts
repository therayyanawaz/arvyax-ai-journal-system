import { JournalRepository } from '../repositories/journalRepository.js';
import type { InsightsResponse } from '../types/journal.js';

type CreateEntryInput = {
  userId: string;
  ambience: string;
  text: string;
};

export class JournalService {
  constructor(private readonly repository: JournalRepository) {}

  async createEntry(input: CreateEntryInput) {
    const entry = await this.repository.createEntry({
      userId: input.userId.trim(),
      ambience: input.ambience.trim().toLowerCase(),
      text: input.text.trim()
    });

    return this.repository.toEntryResponse({
      ...entry,
      analysis: null
    });
  }

  async getEntries(userId: string) {
    const entries = await this.repository.getEntriesForUser(userId);
    return entries.map((entry) => this.repository.toEntryResponse(entry));
  }

  async getInsights(userId: string): Promise<InsightsResponse> {
    const entries = await this.repository.getEntriesForUser(userId);
    const totalEntries = entries.length;
    const ambienceCounts = new Map<string, number>();
    const emotionCounts = new Map<string, number>();
    const recentKeywords: string[] = [];
    const seenKeywords = new Set<string>();

    for (const entry of entries) {
      ambienceCounts.set(entry.ambience, (ambienceCounts.get(entry.ambience) ?? 0) + 1);
    }

    const analyzedEntries = entries
      .filter((entry) => entry.analysis)
      .sort((left, right) => {
        return (
          new Date(right.analysis!.createdAt).getTime() - new Date(left.analysis!.createdAt).getTime()
        );
      });

    for (const entry of analyzedEntries) {
      const analysis = entry.analysis!;
      emotionCounts.set(analysis.emotion, (emotionCounts.get(analysis.emotion) ?? 0) + 1);

      for (const keyword of JSON.parse(analysis.keywordsJson) as string[]) {
        if (!seenKeywords.has(keyword)) {
          seenKeywords.add(keyword);
          recentKeywords.push(keyword);
        }
      }

      if (recentKeywords.length >= 10) {
        break;
      }
    }

    return {
      totalEntries,
      topEmotion: this.pickMostCommon(emotionCounts),
      mostUsedAmbience: this.pickMostCommon(ambienceCounts),
      recentKeywords
    };
  }

  private pickMostCommon(counts: Map<string, number>) {
    if (counts.size === 0) {
      return null;
    }

    const [topEntry] = [...counts.entries()].sort((left, right) => {
      if (right[1] === left[1]) {
        return left[0].localeCompare(right[0]);
      }

      return right[1] - left[1];
    });

    return topEntry?.[0] ?? null;
  }
}
