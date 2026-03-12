import { EventEmitter } from 'node:events';
import {
  createRequire
} from 'node:module';
import readline from 'node:readline';
import {
  spawn,
  type ChildProcessWithoutNullStreams
} from 'node:child_process';

import type { ServerEnv } from '../../config/env.js';
import { env } from '../../config/env.js';
import { InternalServerError } from '../../utils/appError.js';
import type { AnalysisResponse } from '../../types/journal.js';
import {
  buildJournalAnalysisPrompt,
  extractJsonObjectText,
  normalizeAnalysisResponse
} from '../types.js';
import {
  codexAccountLoginCompletedNotificationSchema,
  codexAccountRateLimitsResponseSchema,
  codexAccountReadResponseSchema,
  codexAccountStatusSchema,
  codexItemCompletedNotificationSchema,
  codexAccountUpdatedNotificationSchema,
  codexAvailabilitySchema,
  codexLoginAccountResponseSchema,
  codexLoginStatusSchema,
  codexThreadStartResponseSchema,
  codexTurnCompletedNotificationSchema,
  codexTurnStartResponseSchema,
  type CodexAccountReadResponse,
  type CodexAccountStatus,
  type CodexAppServerAdapter,
  type CodexAvailability,
  type CodexLoginStatus,
  type CodexRateLimitSnapshot
} from './types.js';

const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_TURN_TIMEOUT_MS = 120_000;
const STDERR_BUFFER_LIMIT = 8_000;

type JsonRpcRequest = {
  id: string | number;
  method: string;
  params?: unknown;
};

type JsonRpcNotification = {
  method: string;
  params?: unknown;
};

type JsonRpcSuccess = {
  id: string | number;
  result: unknown;
};

type JsonRpcFailure = {
  id: string | number;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  timeout: NodeJS.Timeout;
};

type CodexCommand = {
  command: string;
  args: string[];
};

type ClientOptions = {
  currentEnv?: ServerEnv;
  logger?: Pick<Console, 'warn' | 'error' | 'info'>;
  spawnProcess?: typeof spawn;
  rootDir?: string;
};

export class CodexAppServerClient implements CodexAppServerAdapter {
  private readonly currentEnv: ServerEnv;
  private readonly logger: Pick<Console, 'warn' | 'error' | 'info'>;
  private readonly spawnProcess: typeof spawn;
  private readonly rootDir: string;
  private readonly events = new EventEmitter();
  private readonly pendingRequests = new Map<string | number, PendingRequest>();
  private readonly loginStatuses = new Map<string, CodexLoginStatus>();

  private child: ChildProcessWithoutNullStreams | null = null;
  private stdoutReader: readline.Interface | null = null;
  private requestCounter = 0;
  private stderrBuffer = '';
  private startupPromise: Promise<void> | null = null;
  private accountSnapshot: CodexAccountReadResponse | null = null;
  private planType: CodexAccountStatus['planType'] = null;
  private authMode: CodexAccountStatus['authMode'] = null;
  private rateLimits: CodexRateLimitSnapshot | null = null;
  private availabilityReason: string | null = null;
  private lastRuntimeError: string | null = null;
  private lastAuthError: string | null = null;
  private activeLoginId: string | null = null;

  constructor(options: ClientOptions = {}) {
    this.currentEnv = options.currentEnv ?? env;
    this.logger = options.logger ?? console;
    this.spawnProcess = options.spawnProcess ?? spawn;
    this.rootDir = options.rootDir ?? process.cwd();
  }

  async getAvailability(): Promise<CodexAvailability> {
    if (!this.currentEnv.CODEX_PROVIDER_ENABLED) {
      return codexAvailabilitySchema.parse({
        enabled: false,
        available: false,
        reason: 'Codex ChatGPT provider is disabled. Set CODEX_PROVIDER_ENABLED=true to enable it.'
      });
    }

    const command = this.resolveBundledCodexCommand();
    if (!command) {
      return codexAvailabilitySchema.parse({
        enabled: true,
        available: false,
        reason:
          'The bundled @openai/codex package is not installed or could not be resolved. Run npm install at the repo root.'
      });
    }

    const runtimeAvailable = !(this.lastRuntimeError && !this.child);

    return codexAvailabilitySchema.parse({
      enabled: true,
      available: runtimeAvailable,
      reason: runtimeAvailable ? this.availabilityReason : this.lastRuntimeError
    });
  }

  async getAccountStatus(refreshToken = false): Promise<CodexAccountStatus> {
    const availability = await this.getAvailability();
    if (!availability.available) {
      return codexAccountStatusSchema.parse({
        enabled: availability.enabled,
        available: false,
        ready: false,
        authStatus: 'unavailable',
        authMode: null,
        email: null,
        planType: null,
        requiresOpenaiAuth: null,
        rateLimits: null,
        availabilityReason: availability.reason,
        activeLoginId: null
      });
    }

    try {
      await this.ensureStarted();
      await this.refreshAccountFromServer(refreshToken);
      await this.refreshRateLimitsFromServer();
    } catch (error) {
      this.lastRuntimeError = error instanceof Error ? error.message : 'Codex app-server failed.';
    }

    const account = this.accountSnapshot?.account ?? null;
    const hasSignedInAccount = account?.type === 'chatgpt';
    const activeLogin = this.activeLoginId ? this.loginStatuses.get(this.activeLoginId) ?? null : null;

    return codexAccountStatusSchema.parse({
      enabled: availability.enabled,
      available: availability.available,
      ready: hasSignedInAccount,
      authStatus: this.resolveAuthStatus(activeLogin, hasSignedInAccount),
      authMode: this.authMode,
      email: account?.type === 'chatgpt' ? account.email : null,
      planType: account?.type === 'chatgpt' ? account.planType : this.planType,
      requiresOpenaiAuth: this.accountSnapshot?.requiresOpenaiAuth ?? null,
      rateLimits: this.rateLimits,
      availabilityReason:
        this.lastAuthError ?? this.availabilityReason ?? this.lastRuntimeError ?? availability.reason,
      activeLoginId: this.activeLoginId
    });
  }

  async startChatGptLogin() {
    const availability = await this.getAvailability();
    if (!availability.available) {
      throw new InternalServerError(
        availability.reason ?? 'Codex ChatGPT provider is unavailable.',
        'CODEX_PROVIDER_UNAVAILABLE'
      );
    }

    await this.ensureStarted();
    const response = await this.sendRequest(
      'account/login/start',
      { type: 'chatgpt' },
      codexLoginAccountResponseSchema,
      30_000
    );

    if (response.type !== 'chatgpt') {
      throw new InternalServerError(
        'Codex app-server did not return a ChatGPT browser-login response.',
        'CODEX_AUTH_FLOW_INVALID'
      );
    }

    const status = codexLoginStatusSchema.parse({
      loginId: response.loginId,
      status: 'pending',
      error: null,
      authUrl: response.authUrl
    });

    this.loginStatuses.set(response.loginId, status);
    this.activeLoginId = response.loginId;
    this.lastAuthError = null;

    return {
      loginId: response.loginId,
      authUrl: response.authUrl
    };
  }

  async getLoginStatus(loginId: string) {
    return this.loginStatuses.get(loginId) ?? null;
  }

  async logout() {
    const availability = await this.getAvailability();
    if (!availability.available) {
      return;
    }

    await this.ensureStarted();
    await this.sendRequest('account/logout', undefined, null, DEFAULT_REQUEST_TIMEOUT_MS);

    this.accountSnapshot = null;
    this.authMode = null;
    this.planType = null;
    this.rateLimits = null;
    this.activeLoginId = null;
    this.lastAuthError = null;
  }

  async analyzeJournal(text: string): Promise<AnalysisResponse> {
    const accountStatus = await this.getAccountStatus(false);
    if (!accountStatus.available) {
      throw new InternalServerError(
        accountStatus.availabilityReason ?? 'Codex ChatGPT provider is unavailable.',
        'CODEX_PROVIDER_UNAVAILABLE'
      );
    }

    if (!accountStatus.ready) {
      throw new InternalServerError(
        'Codex ChatGPT is not signed in. Use the Sign in with ChatGPT flow first.',
        'CODEX_AUTH_REQUIRED'
      );
    }

    await this.ensureStarted();

    const thread = await this.sendRequest(
      'thread/start',
      {
        cwd: this.rootDir,
        approvalPolicy: 'never',
        sandbox: 'read-only',
        serviceName: 'ArvyaX AI-Assisted Journal System',
        baseInstructions:
          'Analyze reflective journal text only. Do not run commands, browse, or modify files.',
        ephemeral: true,
        experimentalRawEvents: false,
        persistExtendedHistory: false
      },
      codexThreadStartResponseSchema,
      30_000
    );

    const threadId = thread.thread.id;

    try {
      const turn = await this.sendRequest(
        'turn/start',
        {
          threadId,
          input: [
            {
              type: 'text',
              text: buildJournalAnalysisPrompt(text),
              text_elements: []
            }
          ],
          outputSchema: {
            type: 'object',
            properties: {
              emotion: { type: 'string' },
              keywords: {
                type: 'array',
                items: { type: 'string' },
                minItems: 3,
                maxItems: 7
              },
              summary: { type: 'string' }
            },
            required: ['emotion', 'keywords', 'summary'],
            additionalProperties: false
          }
        },
        codexTurnStartResponseSchema,
        30_000
      );

      const [agentMessage, completion] = await Promise.all([
        this.waitForAgentMessage(threadId, turn.turn.id, DEFAULT_TURN_TIMEOUT_MS),
        this.waitForTurnCompletion(threadId, turn.turn.id, DEFAULT_TURN_TIMEOUT_MS)
      ]);

      if (completion.turn.status !== 'completed') {
        throw new InternalServerError(
          completion.turn.error?.message ?? 'Codex app-server failed to complete the analysis turn.',
          'CODEX_TURN_FAILED'
        );
      }

      return normalizeAnalysisResponse(JSON.parse(extractJsonObjectText(agentMessage)));
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new InternalServerError(
          'Codex app-server returned invalid JSON.',
          'CODEX_RESPONSE_INVALID'
        );
      }

      if (error instanceof InternalServerError) {
        throw error;
      }

      throw new InternalServerError(
        'Codex app-server failed while analyzing the journal entry.',
        'CODEX_ANALYSIS_FAILED'
      );
    } finally {
      await this.unsubscribeThread(threadId);
    }
  }

  private resolveAuthStatus(activeLogin: CodexLoginStatus | null, hasSignedInAccount: boolean) {
    if ((this.lastAuthError || this.lastRuntimeError) && !hasSignedInAccount && !activeLogin) {
      return 'error' as const;
    }

    if (hasSignedInAccount) {
      return 'signed-in' as const;
    }

    if (activeLogin?.status === 'pending') {
      return 'signing-in' as const;
    }

    if (activeLogin?.status === 'error') {
      return 'error' as const;
    }

    return 'signed-out' as const;
  }

  private async ensureStarted() {
    if (this.startupPromise) {
      return this.startupPromise;
    }

    this.startupPromise = this.startInternal();
    try {
      await this.startupPromise;
    } catch (error) {
      this.startupPromise = null;
      throw error;
    }
  }

  private async startInternal() {
    const command = this.resolveBundledCodexCommand();
    if (!command) {
      this.availabilityReason =
        'The bundled @openai/codex package is not installed or could not be resolved.';
      throw new InternalServerError(this.availabilityReason, 'CODEX_PROVIDER_UNAVAILABLE');
    }

    const childEnv = { ...process.env };
    delete childEnv.OPENAI_API_KEY;
    delete childEnv.OPENAI_BASE_URL;
    delete childEnv.LLM_MODEL;
    delete childEnv.AI_PROVIDER;

    this.child = this.spawnProcess(command.command, [...command.args, 'app-server'], {
      cwd: this.rootDir,
      env: childEnv,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.stdoutReader = readline.createInterface({
      input: this.child.stdout
    });

    this.stdoutReader.on('line', (line) => {
      void this.handleStdoutLine(line);
    });

    this.child.stderr.on('data', (chunk: Buffer | string) => {
      this.stderrBuffer = limitTail(`${this.stderrBuffer}${chunk.toString()}`, STDERR_BUFFER_LIMIT);
    });

    this.child.on('error', (error) => {
      this.handleProcessExit(error instanceof Error ? error.message : 'Codex app-server failed to start.');
    });

    this.child.on('close', (code) => {
      this.handleProcessExit(
        `Codex app-server exited before the request completed (${code ?? 'unknown'}). ${this.stderrBuffer}`.trim()
      );
    });

    try {
      await this.sendRequest(
        'initialize',
        {
          clientInfo: {
            name: 'arvyax_journal_system',
            title: 'ArvyaX AI-Assisted Journal System',
            version: '1.0.0'
          },
          capabilities: {
            experimentalApi: false
          }
        },
        null,
        DEFAULT_REQUEST_TIMEOUT_MS
      );

      await this.sendNotification('initialized');

      this.availabilityReason = null;
      this.lastRuntimeError = null;
    } catch (error) {
      this.handleProcessExit(
        error instanceof Error ? error.message : 'Codex app-server failed during initialization.'
      );
      throw new InternalServerError(
        `Codex app-server failed to initialize. ${this.stderrBuffer}`.trim(),
        'CODEX_APP_SERVER_UNAVAILABLE'
      );
    }
  }

  private async refreshAccountFromServer(refreshToken: boolean) {
    const response = await this.sendRequest(
      'account/read',
      {
        refreshToken
      },
      codexAccountReadResponseSchema,
      DEFAULT_REQUEST_TIMEOUT_MS
    );

    this.accountSnapshot = response;
    if (response.account?.type === 'chatgpt') {
      this.planType = response.account.planType;
      this.authMode = 'chatgpt';
    } else if (response.account?.type === 'apiKey') {
      this.authMode = 'apikey';
    } else if (!this.activeLoginId) {
      this.authMode = null;
      this.planType = null;
    }
  }

  private async refreshRateLimitsFromServer() {
    if (this.accountSnapshot?.account?.type !== 'chatgpt') {
      this.rateLimits = null;
      return;
    }

    try {
      const response = await this.sendRequest(
        'account/rateLimits/read',
        undefined,
        codexAccountRateLimitsResponseSchema,
        DEFAULT_REQUEST_TIMEOUT_MS
      );
      this.rateLimits = response.rateLimits;
    } catch {
      // Rate limits are optional metadata for this UI.
      this.rateLimits = null;
    }
  }

  private async waitForTurnCompletion(threadId: string, turnId: string, timeoutMs: number) {
    return new Promise<ReturnType<typeof codexTurnCompletedNotificationSchema.parse>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.events.off('turn/completed', handler);
        reject(
          new InternalServerError(
            'Codex app-server timed out while waiting for the analysis turn to complete.',
            'CODEX_TURN_TIMEOUT'
          )
        );
      }, timeoutMs);

      const handler = (payload: unknown) => {
        const parsed = codexTurnCompletedNotificationSchema.safeParse(payload);
        if (!parsed.success) {
          return;
        }

        if (parsed.data.threadId !== threadId || parsed.data.turn.id !== turnId) {
          return;
        }

        clearTimeout(timer);
        this.events.off('turn/completed', handler);
        resolve(parsed.data);
      };

      this.events.on('turn/completed', handler);
    });
  }

  private async waitForAgentMessage(threadId: string, turnId: string, timeoutMs: number) {
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.events.off('item/completed', handler);
        reject(
          new InternalServerError(
            'Codex app-server completed without a final agent message.',
            'CODEX_RESPONSE_INVALID'
          )
        );
      }, timeoutMs);

      const handler = (payload: unknown) => {
        const parsed = codexItemCompletedNotificationSchema.safeParse(payload);
        if (!parsed.success) {
          return;
        }

        if (parsed.data.threadId !== threadId || parsed.data.turnId !== turnId) {
          return;
        }

        const item = parsed.data.item;
        if (
          item.type !== 'agentMessage' ||
          !('text' in item) ||
          typeof item.text !== 'string' ||
          item.text.trim().length === 0
        ) {
          return;
        }

        clearTimeout(timer);
        this.events.off('item/completed', handler);
        resolve(item.text);
      };

      this.events.on('item/completed', handler);
    });
  }

  private async unsubscribeThread(threadId: string) {
    try {
      await this.sendRequest(
        'thread/unsubscribe',
        {
          threadId
        },
        null,
        DEFAULT_REQUEST_TIMEOUT_MS
      );
    } catch {
      // Best effort cleanup for ephemeral analysis threads.
    }
  }

  private async handleStdoutLine(rawLine: string) {
    const line = rawLine.trim();
    if (!line) {
      return;
    }

    let message: JsonRpcNotification | JsonRpcRequest | JsonRpcSuccess | JsonRpcFailure;
    try {
      message = JSON.parse(line) as JsonRpcNotification | JsonRpcRequest | JsonRpcSuccess | JsonRpcFailure;
    } catch {
      return;
    }

    if ('id' in message && 'result' in message) {
      const pending = this.pendingRequests.get(message.id);
      if (!pending) {
        return;
      }

      clearTimeout(pending.timeout);
      this.pendingRequests.delete(message.id);
      pending.resolve(message.result);
      return;
    }

    if ('id' in message && 'error' in message) {
      const pending = this.pendingRequests.get(message.id);
      if (!pending) {
        return;
      }

      clearTimeout(pending.timeout);
      this.pendingRequests.delete(message.id);
      pending.reject(
        new InternalServerError(message.error.message, 'CODEX_APP_SERVER_REQUEST_FAILED')
      );
      return;
    }

    if ('id' in message && 'method' in message) {
      await this.sendErrorResponse(
        message.id,
        `The ArvyaX Codex adapter does not support server-initiated request \`${message.method}\`.`
      );
      return;
    }

    if ('method' in message) {
      this.handleNotification(message);
    }
  }

  private handleNotification(message: JsonRpcNotification) {
    switch (message.method) {
      case 'account/login/completed': {
        const parsed = codexAccountLoginCompletedNotificationSchema.safeParse(message.params);
        if (!parsed.success) {
          return;
        }

        if (parsed.data.loginId) {
          const status = codexLoginStatusSchema.parse({
            loginId: parsed.data.loginId,
            status: parsed.data.success ? 'success' : 'error',
            error: parsed.data.error,
            authUrl: this.loginStatuses.get(parsed.data.loginId)?.authUrl ?? null
          });
          this.loginStatuses.set(parsed.data.loginId, status);
          if (this.activeLoginId === parsed.data.loginId && !parsed.data.success) {
            this.lastAuthError = parsed.data.error ?? 'Codex ChatGPT login failed.';
            this.activeLoginId = null;
          }
          if (this.activeLoginId === parsed.data.loginId && parsed.data.success) {
            this.activeLoginId = null;
            this.lastAuthError = null;
            void this.refreshAccountFromServer(false);
            void this.refreshRateLimitsFromServer();
          }
        }
        break;
      }
      case 'account/updated': {
        const parsed = codexAccountUpdatedNotificationSchema.safeParse(message.params);
        if (!parsed.success) {
          return;
        }

        this.authMode = parsed.data.authMode;
        this.planType = parsed.data.planType;
        void this.refreshAccountFromServer(false);
        break;
      }
      case 'account/rateLimits/updated': {
        const params =
          typeof message.params === 'object' && message.params !== null
            ? (message.params as { rateLimits?: unknown })
            : {};
        const parsed = codexAccountRateLimitsResponseSchema.shape.rateLimits.safeParse(
          params.rateLimits
        );
        if (parsed.success) {
          this.rateLimits = parsed.data;
        }
        break;
      }
      case 'turn/completed':
        this.events.emit('turn/completed', message.params);
        break;
      case 'item/completed':
        this.events.emit('item/completed', message.params);
        break;
      default:
        break;
    }
  }

  private async sendErrorResponse(id: string | number, message: string) {
    await this.writeJsonLine({
      id,
      error: {
        code: -32000,
        message
      }
    });
  }

  private async sendNotification(method: string, params?: unknown) {
    await this.writeJsonLine({
      method,
      ...(params === undefined ? {} : { params })
    });
  }

  private async sendRequest<T>(
    method: string,
    params: unknown,
    parser: { parse: (value: unknown) => T } | null,
    timeoutMs: number
  ): Promise<T> {
    if (!this.child?.stdin.writable) {
      throw new InternalServerError(
        'Codex app-server is not running.',
        'CODEX_APP_SERVER_UNAVAILABLE'
      );
    }

    const id = ++this.requestCounter;

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(
          new InternalServerError(
            `Codex app-server timed out while waiting for \`${method}\`.`,
            'CODEX_APP_SERVER_TIMEOUT'
          )
        );
      }, timeoutMs);

      this.pendingRequests.set(id, {
        timeout,
        resolve: (value) => {
          try {
            resolve(parser ? parser.parse(value) : (value as T));
          } catch (error) {
            reject(error);
          }
        },
        reject
      });

      void this.writeJsonLine({
        id,
        method,
        ...(params === undefined ? {} : { params })
      }).catch((error) => {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(error);
      });
    });
  }

  private async writeJsonLine(message: JsonRpcRequest | JsonRpcNotification | JsonRpcFailure) {
    if (!this.child?.stdin.writable) {
      throw new InternalServerError(
        'Codex app-server stdin is unavailable.',
        'CODEX_APP_SERVER_UNAVAILABLE'
      );
    }

    const payload = `${JSON.stringify(message)}\n`;

    await new Promise<void>((resolve, reject) => {
      this.child!.stdin.write(payload, (error) => {
        if (error) {
          reject(
            new InternalServerError(
              'Failed writing to the Codex app-server transport.',
              'CODEX_APP_SERVER_WRITE_FAILED'
            )
          );
          return;
        }

        resolve();
      });
    });
  }

  private handleProcessExit(message: string) {
    this.lastRuntimeError = message;
    this.availabilityReason = message;

    for (const [id, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(
        new InternalServerError(
          message || 'Codex app-server stopped unexpectedly.',
          'CODEX_APP_SERVER_UNAVAILABLE'
        )
      );
      this.pendingRequests.delete(id);
    }

    this.stdoutReader?.close();
    this.stdoutReader = null;
    this.child = null;
  }

  private resolveBundledCodexCommand(): CodexCommand | null {
    const require = createRequire(import.meta.url);

    try {
      const entryPath = require.resolve('@openai/codex/bin/codex.js');
      return {
        command: process.execPath,
        args: [entryPath]
      };
    } catch {
      return null;
    }
  }
}

function limitTail(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return value.slice(value.length - maxLength);
}
