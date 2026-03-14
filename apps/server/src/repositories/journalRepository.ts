import { Prisma, type JournalAnalysis, type JournalEntry } from '@prisma/client';

import { prisma } from '../lib/prisma.js';

export class JournalRepository {
  async createEntry(data: { userId: string; ambience: string; text: string }) {
    return prisma.journalEntry.create({
      data
    });
  }

  async getEntriesForUser(userId: string) {
    return prisma.journalEntry.findMany({
      where: { userId },
      include: {
        analysis: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async getEntryById(id: string) {
    return prisma.journalEntry.findUnique({
      where: { id },
      include: {
        analysis: true
      }
    });
  }

  async getAnalysisByEntryId(journalEntryId: string) {
    return prisma.journalAnalysis.findUnique({
      where: { journalEntryId }
    });
  }

  async getCachedAnalysis(textHash: string) {
    return prisma.journalAnalysis.findFirst({
      where: { textHash },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async createAnalysis(data: {
    journalEntryId?: string;
    emotion: string;
    keywordsJson: string;
    summary: string;
    textHash: string;
  }) {
    return prisma.journalAnalysis.create({
      data
    });
  }

  async createAnalysisForEntryOrGetExisting(data: {
    journalEntryId: string;
    emotion: string;
    keywordsJson: string;
    summary: string;
    textHash: string;
  }) {
    try {
      return await prisma.journalAnalysis.create({
        data
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await prisma.journalAnalysis.findUnique({
          where: {
            journalEntryId: data.journalEntryId
          }
        });

        if (existing) {
          return existing;
        }
      }

      throw error;
    }
  }

  async clearAll() {
    await prisma.journalAnalysis.deleteMany();
    await prisma.journalEntry.deleteMany();
  }

  toEntryResponse(entry: JournalEntry & { analysis: JournalAnalysis | null }) {
    return {
      id: entry.id,
      userId: entry.userId,
      ambience: entry.ambience,
      text: entry.text,
      createdAt: entry.createdAt.toISOString(),
      analysis: entry.analysis
        ? {
            id: entry.analysis.id,
            emotion: entry.analysis.emotion,
            keywords: JSON.parse(entry.analysis.keywordsJson) as string[],
            summary: entry.analysis.summary,
            textHash: entry.analysis.textHash,
            createdAt: entry.analysis.createdAt.toISOString()
          }
        : null
    };
  }
}
