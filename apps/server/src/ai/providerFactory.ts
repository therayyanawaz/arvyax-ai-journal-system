import { CodexAppServerClient } from './codexAppServer/client.js';
import type { CodexAppServerAdapter } from './codexAppServer/types.js';
import { env, type ServerEnv } from '../config/env.js';
import { BadRequestError, InternalServerError } from '../utils/appError.js';
import { CodexChatgptProvider } from './providers/codexChatgptProvider.js';
import { OpenAiApiProvider } from './providers/openaiApiProvider.js';
import type {
  AiProvider,
  AiProviderName,
  AiProviderRuntime,
  AiProviderStatus
} from './types.js';

type CreateAiRuntimeOptions = {
  currentEnv?: ServerEnv;
  codexClient?: CodexAppServerAdapter;
  providers?: AiProvider[];
};

class DefaultAiProviderRuntime implements AiProviderRuntime {
  private readonly providers = new Map<AiProviderName, AiProvider>();
  private activeProviderName: AiProviderName;

  constructor(initialProviderName: AiProviderName, providers: AiProvider[]) {
    this.activeProviderName = initialProviderName;

    for (const provider of providers) {
      this.providers.set(provider.name, provider);
    }
  }

  getActiveProvider() {
    const provider = this.providers.get(this.activeProviderName);
    if (!provider) {
      throw new InternalServerError(
        `AI provider \`${this.activeProviderName}\` is not registered.`,
        'AI_PROVIDER_NOT_REGISTERED'
      );
    }

    return provider;
  }

  getActiveProviderName() {
    return this.activeProviderName;
  }

  async listProviders() {
    const results: AiProviderStatus[] = [];

    for (const provider of this.providers.values()) {
      const health = await provider.getHealth();
      results.push({
        name: provider.name,
        label: provider.label,
        selected: provider.name === this.activeProviderName,
        ...health
      });
    }

    return results;
  }

  async setActiveProvider(name: AiProviderName) {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new BadRequestError(`AI provider \`${name}\` is not available.`, 'AI_PROVIDER_UNKNOWN');
    }

    const health = await provider.getHealth();
    if (!health.available) {
      throw new BadRequestError(
        health.reason ?? `AI provider \`${name}\` is not available in this environment.`,
        'AI_PROVIDER_UNAVAILABLE'
      );
    }

    this.activeProviderName = name;
    return this.listProviders();
  }
}

export function createAiRuntime(options: CreateAiRuntimeOptions = {}): {
  runtime: AiProviderRuntime;
  codexClient: CodexAppServerAdapter;
} {
  const currentEnv = options.currentEnv ?? env;
  const codexClient = options.codexClient ?? new CodexAppServerClient({ currentEnv });
  const providers =
    options.providers ??
    [new OpenAiApiProvider(), new CodexChatgptProvider(codexClient)];

  const initialProviderName = providers.some((provider) => provider.name === currentEnv.AI_PROVIDER)
    ? currentEnv.AI_PROVIDER
    : providers[0]!.name;

  return {
    runtime: new DefaultAiProviderRuntime(initialProviderName, providers),
    codexClient
  };
}

export async function assertAiProviderAllowed(
  runtime: AiProviderRuntime,
  codexClient: CodexAppServerAdapter,
  currentEnv: ServerEnv = env
) {
  if (currentEnv.AI_PROVIDER !== 'codexChatgpt') {
    return;
  }

  if (!currentEnv.CODEX_PROVIDER_ENABLED) {
    throw new Error(
      [
        'REFUSING TO START SERVER',
        'AI_PROVIDER=codexChatgpt requires CODEX_PROVIDER_ENABLED=true.',
        'This provider uses the bundled Codex app-server browser-login flow.'
      ].join('\n')
    );
  }

  const selectedProvider = runtime.getActiveProvider();
  const health = await selectedProvider.getHealth();
  const availability = await codexClient.getAvailability();

  if (!availability.available || !health.available) {
    throw new Error(
      [
        'REFUSING TO START SERVER',
        'AI_PROVIDER=codexChatgpt is selected but the Codex app-server adapter is unavailable.',
        availability.reason ?? health.reason ?? 'Unknown Codex app-server startup failure.'
      ].join('\n')
    );
  }
}

export function logAiProviderStartupMessage(
  currentEnv: ServerEnv = env,
  logger: (...messages: string[]) => void = console.warn
) {
  if (!currentEnv.CODEX_PROVIDER_ENABLED) {
    return;
  }

  logger('');
  logger('#####################################################################');
  logger('# CODEX CHATGPT BROWSER LOGIN MODE IS ENABLED                      #');
  logger('# This uses the official Codex app-server ChatGPT-managed auth flow #');
  logger('# Best suited to trusted/local rich-client usage                   #');
  logger('# OpenAI API key mode remains the recommended production default    #');
  logger('#####################################################################');
  logger('');
}
