import { createAiRuntime } from './ai/providerFactory.js';
import { CodexAppServerClient } from './ai/codexAppServer/client.js';
import type { CodexAppServerAdapter } from './ai/codexAppServer/types.js';
import type { AiProvider, AiProviderRuntime } from './ai/types.js';
import cors from 'cors';
import express from 'express';

import { AiController } from './controllers/aiController.js';
import { CodexAuthController } from './controllers/codexAuthController.js';
import { JournalController } from './controllers/journalController.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { JournalRepository } from './repositories/journalRepository.js';
import { createAiRouter } from './routes/aiRoutes.js';
import { createCodexAuthRouter } from './routes/codexAuthRoutes.js';
import { AnalysisService } from './services/analysisService.js';
import { JournalService } from './services/journalService.js';
import { createJournalRouter } from './routes/journalRoutes.js';

type CreateAppOptions = {
  aiProvider?: AiProvider;
  aiRuntime?: AiProviderRuntime;
  codexClient?: CodexAppServerAdapter;
};

export function createApp(options: CreateAppOptions = {}) {
  const repository = new JournalRepository();
  const { runtime, codexClient } = options.aiRuntime
    ? {
        runtime: options.aiRuntime,
        codexClient: options.codexClient ?? new CodexAppServerClient()
      }
    : createAiRuntime({
        codexClient: options.codexClient,
        providers: options.aiProvider ? [options.aiProvider] : undefined
      });
  const journalService = new JournalService(repository);
  const analysisService = new AnalysisService(repository, runtime);
  const journalController = new JournalController(journalService, analysisService);
  const aiController = new AiController(runtime);
  const codexAuthController = new CodexAuthController(codexClient);

  const app = express();

  app.use(
    cors({
      origin: true
    })
  );
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api/ai', createAiRouter(aiController));
  app.use('/api/auth/codex', createCodexAuthRouter(codexAuthController));
  app.use('/api/journal', createJournalRouter(journalController));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
