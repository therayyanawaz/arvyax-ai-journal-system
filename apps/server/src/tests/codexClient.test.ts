import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';

import { env } from '../config/env.js';
import { CodexAppServerClient } from '../ai/codexAppServer/client.js';

type JsonRpcRequest = {
  id?: number | string;
  method?: string;
};

function createMockCodexChild(instanceId: number) {
  const child = new EventEmitter() as ChildProcessWithoutNullStreams;
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  let buffer = '';

  stdin.on('data', (chunk) => {
    buffer += chunk.toString();

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      const message = JSON.parse(line) as JsonRpcRequest;
      if (!message.id || !message.method) {
        continue;
      }

      if (message.method === 'initialize') {
        stdout.write(JSON.stringify({ id: message.id, result: {} }) + '\n');
        continue;
      }

      if (message.method === 'account/login/start') {
        stdout.write(
          JSON.stringify({
            id: message.id,
            result: {
              type: 'chatgpt',
              loginId: `login-${instanceId}`,
              authUrl: 'https://chatgpt.com/codex-login'
            }
          }) + '\n'
        );
      }
    }
  });

  child.stdin = stdin;
  child.stdout = stdout;
  child.stderr = stderr;

  return child;
}

describe('codex app-server client', () => {
  it('restarts the bundled app-server after an unexpected close', async () => {
    const children: ChildProcessWithoutNullStreams[] = [];
    const spawnProcess = vi.fn(() => {
      const child = createMockCodexChild(children.length + 1);
      children.push(child);
      return child;
    });

    const client = new CodexAppServerClient({
      currentEnv: {
        ...env,
        CODEX_PROVIDER_ENABLED: true
      },
      spawnProcess: spawnProcess as typeof import('node:child_process').spawn
    });

    const firstLogin = await client.startChatGptLogin();
    expect(firstLogin.loginId).toBe('login-1');
    expect(spawnProcess).toHaveBeenCalledTimes(1);

    children[0]?.emit('close', 1);

    const secondLogin = await client.startChatGptLogin();
    expect(secondLogin.loginId).toBe('login-2');
    expect(spawnProcess).toHaveBeenCalledTimes(2);
  });
});
