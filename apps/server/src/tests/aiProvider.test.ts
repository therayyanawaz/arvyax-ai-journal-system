import { CodexChatgptProvider } from '../ai/providers/codexChatgptProvider.js';
import { OpenAiApiProvider } from '../ai/providers/openaiApiProvider.js';
import {
  assertAiProviderAllowed,
  createAiRuntime,
  logAiProviderStartupMessage
} from '../ai/providerFactory.js';
import { env } from '../config/env.js';

describe('ai provider layer', () => {
  const originalEnv = {
    AI_PROVIDER: env.AI_PROVIDER,
    CODEX_PROVIDER_ENABLED: env.CODEX_PROVIDER_ENABLED,
    NODE_ENV: env.NODE_ENV
  };

  afterEach(() => {
    env.AI_PROVIDER = originalEnv.AI_PROVIDER;
    env.CODEX_PROVIDER_ENABLED = originalEnv.CODEX_PROVIDER_ENABLED;
    env.NODE_ENV = originalEnv.NODE_ENV;
    vi.restoreAllMocks();
  });

  it('selects the openai api provider by default', () => {
    env.AI_PROVIDER = 'openaiApi';

    const { runtime } = createAiRuntime();

    expect(runtime.getActiveProvider()).toBeInstanceOf(OpenAiApiProvider);
  });

  it('selects the codex chatgpt provider when configured', () => {
    env.AI_PROVIDER = 'codexChatgpt';
    env.CODEX_PROVIDER_ENABLED = true;

    const { runtime } = createAiRuntime();

    expect(runtime.getActiveProvider()).toBeInstanceOf(CodexChatgptProvider);
  });

  it('rejects codexChatgpt startup when the provider is disabled', async () => {
    env.AI_PROVIDER = 'codexChatgpt';
    env.CODEX_PROVIDER_ENABLED = false;

    const { runtime, codexClient } = createAiRuntime();

    await expect(assertAiProviderAllowed(runtime, codexClient)).rejects.toThrow(
      /CODEX_PROVIDER_ENABLED=true/i
    );
  });

  it('prints a warning banner when codex browser-login mode is enabled', () => {
    env.CODEX_PROVIDER_ENABLED = true;
    const warningSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    logAiProviderStartupMessage();

    expect(warningSpy).toHaveBeenCalled();
    expect(warningSpy.mock.calls.flat().join('\n')).toMatch(/trusted\/local rich-client usage/i);
  });

  it('reports codex provider health as not ready when ChatGPT login is missing', async () => {
    const provider = new CodexChatgptProvider({
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
        availabilityReason: 'Sign in with ChatGPT first.',
        activeLoginId: null
      }),
      startChatGptLogin: vi.fn(),
      getLoginStatus: vi.fn(),
      logout: vi.fn(),
      analyzeJournal: vi.fn()
    });

    await expect(provider.getHealth()).resolves.toEqual({
      available: true,
      ready: false,
      reason: 'Sign in with ChatGPT first.'
    });
  });
});
