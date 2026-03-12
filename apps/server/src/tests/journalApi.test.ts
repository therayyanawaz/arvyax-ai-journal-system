import request from 'supertest';

import { createApp } from '../app.js';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { AnalysisService } from '../services/analysisService.js';
import { hashText } from '../utils/hash.js';

describe('journal api', () => {
  beforeEach(async () => {
    await prisma.journalAnalysis.deleteMany();
    await prisma.journalEntry.deleteMany();
  });

  it('creates a journal entry', async () => {
    const response = await request(createApp()).post('/api/journal').send({
      userId: '123',
      ambience: 'forest',
      text: 'I felt calm today after listening to the rain.'
    });

    expect(response.status).toBe(201);
    expect(response.body.userId).toBe('123');
    expect(response.body.ambience).toBe('forest');
    expect(response.body.text).toContain('calm');
    expect(response.body.id).toBeTypeOf('string');
  });

  it('returns 400 with the standard error shape for invalid journal input', async () => {
    const response = await request(createApp()).post('/api/journal').send({
      userId: '123',
      ambience: 'desert',
      text: 'bad'
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed.'
      }
    });
  });

  it('returns entries newest first', async () => {
    const app = createApp();

    await request(app).post('/api/journal').send({
      userId: '123',
      ambience: 'forest',
      text: 'First entry'
    });
    await request(app).post('/api/journal').send({
      userId: '123',
      ambience: 'ocean',
      text: 'Second entry'
    });

    const response = await request(app).get('/api/journal/123');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body[0].text).toBe('Second entry');
    expect(response.body[1].text).toBe('First entry');
  });

  it('returns sensible insights without analyses', async () => {
    const app = createApp();

    await request(app).post('/api/journal').send({
      userId: 'insights-user',
      ambience: 'mountain',
      text: 'I felt grounded.'
    });

    const response = await request(app).get('/api/journal/insights/insights-user');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      totalEntries: 1,
      topEmotion: null,
      mostUsedAmbience: 'mountain',
      recentKeywords: []
    });
  });

  it('returns 500 with the standard error shape when analysis is requested without llm env vars', async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.LLM_MODEL;

    const response = await request(createApp()).post('/api/journal/analyze').send({
      text: 'I felt calm today after listening to the rain.'
    });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: 'LLM_UNAVAILABLE',
        message: 'LLM configuration is missing. Set OPENAI_API_KEY, OPENAI_BASE_URL, and LLM_MODEL.'
      }
    });
  });

  it('returns 404 when a referenced journal entry is missing during analysis', async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.LLM_MODEL;

    const response = await request(createApp()).post('/api/journal/analyze').send({
      journalEntryId: 'missing-entry-id',
      text: 'I felt calm today after listening to the rain.'
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: 'ENTRY_NOT_FOUND',
        message: 'Journal entry was not found.'
      }
    });
  });

  it('reuses a cached analysis for repeated text without requiring llm env vars', async () => {
    const firstEntry = await prisma.journalEntry.create({
      data: {
        userId: '123',
        ambience: 'forest',
        text: 'Rain made me feel calm and centered.'
      }
    });

    await prisma.journalAnalysis.create({
      data: {
        journalEntryId: firstEntry.id,
        emotion: 'calm',
        keywordsJson: JSON.stringify(['rain', 'calm', 'centered']),
        summary: 'The entry reflects calm after a rainy nature session.',
        textHash: hashText(firstEntry.text)
      }
    });

    const secondEntry = await prisma.journalEntry.create({
      data: {
        userId: '123',
        ambience: 'ocean',
        text: firstEntry.text
      }
    });

    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.LLM_MODEL;

    const response = await request(createApp()).post('/api/journal/analyze').send({
      journalEntryId: secondEntry.id,
      text: secondEntry.text
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      emotion: 'calm',
      keywords: ['rain', 'calm', 'centered'],
      summary: 'The entry reflects calm after a rainy nature session.'
    });

    const storedAnalysis = await prisma.journalAnalysis.findUnique({
      where: {
        journalEntryId: secondEntry.id
      }
    });

    expect(storedAnalysis?.emotion).toBe('calm');
    expect(storedAnalysis?.textHash).toBe(hashText(secondEntry.text));
  });

  it('persists raw text analysis results using the text hash cache when llm analysis succeeds', async () => {
    const originalEnv = {
      OPENAI_API_KEY: env.OPENAI_API_KEY,
      OPENAI_BASE_URL: env.OPENAI_BASE_URL,
      LLM_MODEL: env.LLM_MODEL
    };

    env.OPENAI_API_KEY = 'test-key';
    env.OPENAI_BASE_URL = 'https://example.com/v1';
    env.LLM_MODEL = 'test-model';

    const llmSpy = vi
      .spyOn(AnalysisService.prototype as never, 'requestAnalysisFromLlm' as never)
      .mockResolvedValue({
        emotion: 'calm',
        keywords: ['rain', 'peace', 'nature'],
        summary: 'The entry reflects calm after a nature session.'
      });

    try {
      const text = 'I felt calm today after listening to the rain.';
      const response = await request(createApp()).post('/api/journal/analyze').send({ text });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        emotion: 'calm',
        keywords: ['rain', 'peace', 'nature'],
        summary: 'The entry reflects calm after a nature session.'
      });

      const cachedAnalysis = await prisma.journalAnalysis.findFirst({
        where: {
          textHash: hashText(text)
        }
      });

      expect(cachedAnalysis?.journalEntryId ?? null).toBeNull();
      expect(cachedAnalysis?.emotion).toBe('calm');
    } finally {
      llmSpy.mockRestore();
      env.OPENAI_API_KEY = originalEnv.OPENAI_API_KEY;
      env.OPENAI_BASE_URL = originalEnv.OPENAI_BASE_URL;
      env.LLM_MODEL = originalEnv.LLM_MODEL;
    }
  });
});
