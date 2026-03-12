import { InternalServerError } from '../../utils/appError.js';
import type { CodexAppServerAdapter } from '../codexAppServer/types.js';
import type { AiProvider } from '../types.js';

export class CodexChatgptProvider implements AiProvider {
  readonly name = 'codexChatgpt' as const;
  readonly label = 'Codex ChatGPT';

  constructor(private readonly codexClient: CodexAppServerAdapter) {}

  async getHealth() {
    const availability = await this.codexClient.getAvailability();
    if (!availability.available) {
      return {
        available: false,
        ready: false,
        reason: availability.reason
      };
    }

    const account = await this.codexClient.getAccountStatus(false);

    return {
      available: true,
      ready: account.ready,
      reason: account.ready
        ? null
        : account.availabilityReason ?? 'Sign in with ChatGPT to use Codex-backed analysis.'
    };
  }

  async analyzeJournal(text: string) {
    const health = await this.getHealth();
    if (!health.available) {
      throw new InternalServerError(
        health.reason ?? 'Codex ChatGPT provider is unavailable.',
        'CODEX_PROVIDER_UNAVAILABLE'
      );
    }

    if (!health.ready) {
      throw new InternalServerError(
        health.reason ?? 'Codex ChatGPT is not signed in.',
        'CODEX_AUTH_REQUIRED'
      );
    }

    return this.codexClient.analyzeJournal(text);
  }
}
