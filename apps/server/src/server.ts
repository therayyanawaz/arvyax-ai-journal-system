import 'dotenv/config';

import { assertAiProviderAllowed, createAiRuntime, logAiProviderStartupMessage } from './ai/providerFactory.js';
import { env } from './config/env.js';
import { createApp } from './app.js';

logAiProviderStartupMessage();

const { runtime, codexClient } = createAiRuntime();

await assertAiProviderAllowed(runtime, codexClient);

const app = createApp({
  aiRuntime: runtime,
  codexClient
});

app.listen(env.PORT, () => {
  console.log(`Server listening on port ${env.PORT}`);
});
