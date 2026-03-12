import request from 'supertest';

import { createApp } from '../app.js';
import type { CodexAppServerAdapter } from '../ai/codexAppServer/types.js';
import type { AiProviderRuntime } from '../ai/types.js';

function createTestRuntime(): AiProviderRuntime {
  let activeProvider: 'openaiApi' | 'codexChatgpt' = 'openaiApi';
  const providers = [
    {
      name: 'openaiApi' as const,
      label: 'OpenAI API',
      selected: true,
      available: true,
      ready: true,
      reason: null
    },
    {
      name: 'codexChatgpt' as const,
      label: 'Codex ChatGPT',
      selected: false,
      available: true,
      ready: false,
      reason: 'Sign in with ChatGPT to use this provider.'
    }
  ];

  return {
    getActiveProvider() {
      return {
        name: activeProvider,
        label: activeProvider === 'openaiApi' ? 'OpenAI API' : 'Codex ChatGPT',
        async getHealth() {
          return {
            available: true,
            ready: true,
            reason: null
          };
        },
        async analyzeJournal() {
          return {
            emotion: 'calm',
            keywords: ['rain', 'focus', 'steady'],
            summary: 'A short summary.'
          };
        }
      };
    },
    getActiveProviderName() {
      return activeProvider;
    },
    async listProviders() {
      return providers.map((provider) => ({
        ...provider,
        selected: provider.name === activeProvider
      }));
    },
    async setActiveProvider(name) {
      activeProvider = name;
      return this.listProviders();
    }
  };
}

function createTestCodexClient(): CodexAppServerAdapter {
  return {
    getAvailability: vi.fn().mockResolvedValue({
      enabled: true,
      available: true,
      reason: null
    }),
    getAccountStatus: vi.fn().mockResolvedValue({
      enabled: true,
      available: true,
      ready: false,
      authStatus: 'signed-out',
      authMode: null,
      email: null,
      planType: null,
      requiresOpenaiAuth: true,
      rateLimits: null,
      availabilityReason: 'Sign in with ChatGPT to use Codex-backed analysis.',
      activeLoginId: null
    }),
    startChatGptLogin: vi.fn().mockResolvedValue({
      loginId: 'login-123',
      authUrl: 'https://chatgpt.com/codex-login'
    }),
    getLoginStatus: vi.fn().mockResolvedValue({
      loginId: 'login-123',
      status: 'pending',
      error: null,
      authUrl: 'https://chatgpt.com/codex-login'
    }),
    logout: vi.fn().mockResolvedValue(undefined),
    analyzeJournal: vi.fn()
  };
}

describe('provider and codex auth routes', () => {
  it('returns provider state for the frontend selector', async () => {
    const response = await request(
      createApp({
        aiRuntime: createTestRuntime(),
        codexClient: createTestCodexClient()
      })
    ).get('/api/ai/provider');

    expect(response.status).toBe(200);
    expect(response.body.activeProvider).toBe('openaiApi');
    expect(response.body.providers).toHaveLength(2);
  });

  it('switches the active provider', async () => {
    const app = createApp({
      aiRuntime: createTestRuntime(),
      codexClient: createTestCodexClient()
    });

    const response = await request(app).post('/api/ai/provider').send({
      provider: 'codexChatgpt'
    });

    expect(response.status).toBe(200);
    expect(response.body.activeProvider).toBe('codexChatgpt');
  });

  it('starts the Codex ChatGPT login flow', async () => {
    const response = await request(
      createApp({
        aiRuntime: createTestRuntime(),
        codexClient: createTestCodexClient()
      })
    ).post('/api/auth/codex/start');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      loginId: 'login-123',
      authUrl: 'https://chatgpt.com/codex-login'
    });
  });

  it('returns login status and account state', async () => {
    const app = createApp({
      aiRuntime: createTestRuntime(),
      codexClient: createTestCodexClient()
    });

    const loginResponse = await request(app).get('/api/auth/codex/status/login-123');
    const accountResponse = await request(app).get('/api/auth/codex/account');

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.status).toBe('pending');
    expect(accountResponse.status).toBe(200);
    expect(accountResponse.body.authStatus).toBe('signed-out');
  });

  it('logs out the current Codex session', async () => {
    const response = await request(
      createApp({
        aiRuntime: createTestRuntime(),
        codexClient: createTestCodexClient()
      })
    ).post('/api/auth/codex/logout');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
  });
});
