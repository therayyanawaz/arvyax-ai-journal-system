import cors from 'cors';
import express from 'express';

import { JournalController } from './controllers/journalController.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { JournalRepository } from './repositories/journalRepository.js';
import { AnalysisService } from './services/analysisService.js';
import { JournalService } from './services/journalService.js';
import { createJournalRouter } from './routes/journalRoutes.js';

export function createApp() {
  const repository = new JournalRepository();
  const journalService = new JournalService(repository);
  const analysisService = new AnalysisService(repository);
  const controller = new JournalController(journalService, analysisService);

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

  app.use('/api/journal', createJournalRouter(controller));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
