import 'dotenv/config';

import assert from 'node:assert/strict';

import { createServer } from 'node:http';

import { createApp } from '../app.js';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { hashText } from '../utils/hash.js';

const verifyUserId = 'verify-e2e-user';
const createdEntryText = 'The forest rain helped me feel centered today.';
const cachedEntryText = 'Ocean sounds helped me feel calm and clear tonight.';
const cachedAnalysis = {
  emotion: 'calm',
  keywords: ['ocean', 'calm', 'clarity'],
  summary: 'The entry reflects calm and clarity after an ocean session.'
};

async function main() {
  const previousProvider = env.AI_PROVIDER;
  const previousCodexEnabled = env.CODEX_PROVIDER_ENABLED;
  env.AI_PROVIDER = 'openaiApi';
  env.CODEX_PROVIDER_ENABLED = false;

  await resetVerifyData();

  const app = createApp();
  const server = createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  assert(address && typeof address === 'object', 'Failed to start verification server.');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await verifyProviderState(baseUrl);
    await verifyCodexAccountState(baseUrl);
    await verifyCodexLoginStartFailsClearlyWhenDisabled(baseUrl);
    const createdEntry = await verifyCreateEntry(baseUrl);
    await verifyInvalidCreateEntry(baseUrl);
    const analyzedEntry = await verifyAnalyzeSuccessViaCache(baseUrl);
    await verifyListEntries(baseUrl, [createdEntry.id, analyzedEntry.id]);
    await verifyInsights(baseUrl);
    await verifyAnalyzeMissingEntry(baseUrl);
    await verifyAnalyzeMissingLlm(baseUrl);

    console.log('Endpoint verification passed.');
  } finally {
    env.AI_PROVIDER = previousProvider;
    env.CODEX_PROVIDER_ENABLED = previousCodexEnabled;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
    await prisma.$disconnect();
  }
}

async function verifyProviderState(baseUrl: string) {
  const response = await apiRequest(baseUrl, '/api/ai/provider');

  assert.equal(response.status, 200, 'GET /api/ai/provider should return 200.');
  assert.equal(response.json.activeProvider, 'openaiApi');
  assert.ok(Array.isArray(response.json.providers), 'Provider list should be returned.');
}

async function verifyCodexAccountState(baseUrl: string) {
  const response = await apiRequest(baseUrl, '/api/auth/codex/account');

  assert.equal(response.status, 200, 'GET /api/auth/codex/account should return 200.');
  assert.equal(response.json.available, false);
  assert.equal(response.json.authStatus, 'unavailable');
}

async function verifyCodexLoginStartFailsClearlyWhenDisabled(baseUrl: string) {
  const response = await apiRequest(baseUrl, '/api/auth/codex/start', {
    method: 'POST'
  });

  assert.equal(response.status, 500, 'Disabled Codex login should return 500.');
  assert.deepEqual(response.json, {
    error: {
      code: 'CODEX_PROVIDER_UNAVAILABLE',
      message: 'Codex ChatGPT provider is disabled. Set CODEX_PROVIDER_ENABLED=true to enable it.'
    }
  });
}

async function verifyCreateEntry(baseUrl: string) {
  const response = await apiRequest(baseUrl, '/api/journal', {
    method: 'POST',
    body: {
      userId: verifyUserId,
      ambience: 'forest',
      text: createdEntryText
    }
  });

  assert.equal(response.status, 201, 'POST /api/journal should return 201.');
  assert.equal(response.json.userId, verifyUserId);
  assert.equal(response.json.ambience, 'forest');
  assert.equal(response.json.analysis, null);

  return response.json as { id: string };
}

async function verifyInvalidCreateEntry(baseUrl: string) {
  const response = await apiRequest(baseUrl, '/api/journal', {
    method: 'POST',
    body: {
      userId: verifyUserId,
      ambience: 'desert',
      text: 'bad'
    }
  });

  assert.equal(response.status, 400, 'Invalid journal input should return 400.');
  assert.deepEqual(response.json, {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed.'
    }
  });
}

async function verifyAnalyzeSuccessViaCache(baseUrl: string) {
  await prisma.journalAnalysis.deleteMany({
    where: {
      textHash: hashText(cachedEntryText)
    }
  });

  await prisma.journalAnalysis.create({
    data: {
      emotion: cachedAnalysis.emotion,
      keywordsJson: JSON.stringify(cachedAnalysis.keywords),
      summary: cachedAnalysis.summary,
      textHash: hashText(cachedEntryText)
    }
  });

  const createdEntry = await apiRequest(baseUrl, '/api/journal', {
    method: 'POST',
    body: {
      userId: verifyUserId,
      ambience: 'ocean',
      text: cachedEntryText
    }
  });

  const response = await apiRequest(baseUrl, '/api/journal/analyze', {
    method: 'POST',
    body: {
      journalEntryId: createdEntry.json.id,
      text: cachedEntryText
    }
  });

  assert.equal(response.status, 200, 'POST /api/journal/analyze should return 200 on success.');
  assert.deepEqual(response.json, cachedAnalysis);

  const storedAnalysis = await prisma.journalAnalysis.findUnique({
    where: {
      journalEntryId: createdEntry.json.id
    }
  });

  assert.ok(storedAnalysis, 'Expected cached analysis to be associated with the created entry.');

  return createdEntry.json as { id: string };
}

async function verifyListEntries(baseUrl: string, expectedEntryIds: string[]) {
  const response = await apiRequest(baseUrl, `/api/journal/${verifyUserId}`);

  assert.equal(response.status, 200, 'GET /api/journal/:userId should return 200.');
  assert.equal(response.json.length, expectedEntryIds.length);
  assert.deepEqual(
    response.json.map((entry: { id: string }) => entry.id),
    expectedEntryIds.reverse(),
    'Entries should be returned newest first.'
  );
}

async function verifyInsights(baseUrl: string) {
  const response = await apiRequest(baseUrl, `/api/journal/insights/${verifyUserId}`);

  assert.equal(response.status, 200, 'GET /api/journal/insights/:userId should return 200.');
  assert.deepEqual(response.json, {
    totalEntries: 2,
    topEmotion: 'calm',
    mostUsedAmbience: 'forest',
    recentKeywords: cachedAnalysis.keywords
  });
}

async function verifyAnalyzeMissingEntry(baseUrl: string) {
  const response = await apiRequest(baseUrl, '/api/journal/analyze', {
    method: 'POST',
    body: {
      journalEntryId: 'missing-entry-id',
      text: createdEntryText
    }
  });

  assert.equal(response.status, 404, 'Missing entry analysis should return 404.');
  assert.deepEqual(response.json, {
    error: {
      code: 'ENTRY_NOT_FOUND',
      message: 'Journal entry was not found.'
    }
  });
}

async function verifyAnalyzeMissingLlm(baseUrl: string) {
  const previous = {
    apiKey: env.OPENAI_API_KEY,
    baseUrl: env.OPENAI_BASE_URL,
    model: env.LLM_MODEL
  };

  env.OPENAI_API_KEY = undefined;
  env.OPENAI_BASE_URL = undefined;
  env.LLM_MODEL = undefined;

  try {
    const response = await apiRequest(baseUrl, '/api/journal/analyze', {
      method: 'POST',
      body: {
        text: 'This text is not cached and should trigger an llm configuration error.'
      }
    });

    assert.equal(response.status, 500, 'Missing LLM config should return 500.');
    assert.deepEqual(response.json, {
      error: {
        code: 'LLM_UNAVAILABLE',
        message: 'LLM configuration is missing. Set OPENAI_API_KEY, OPENAI_BASE_URL, and LLM_MODEL.'
      }
    });
  } finally {
    env.OPENAI_API_KEY = previous.apiKey;
    env.OPENAI_BASE_URL = previous.baseUrl;
    env.LLM_MODEL = previous.model;
  }
}

async function apiRequest(baseUrl: string, path: string, init?: { method?: string; body?: unknown }) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json'
    },
    body: init?.body ? JSON.stringify(init.body) : undefined
  });

  const json = await response.json();
  return {
    status: response.status,
    json
  };
}

async function resetVerifyData() {
  const existingEntries = await prisma.journalEntry.findMany({
    where: { userId: verifyUserId },
    select: { id: true }
  });

  const entryIds = existingEntries.map((entry) => entry.id);

  if (entryIds.length > 0) {
    await prisma.journalAnalysis.deleteMany({
      where: {
        journalEntryId: {
          in: entryIds
        }
      }
    });
  }

  await prisma.journalEntry.deleteMany({
    where: { userId: verifyUserId }
  });

  await prisma.journalAnalysis.deleteMany({
    where: {
      journalEntryId: null,
      textHash: {
        in: [hashText(cachedEntryText)]
      }
    }
  });
}

main().catch((error) => {
  console.error('Endpoint verification failed.');
  console.error(error);
  process.exitCode = 1;
});
