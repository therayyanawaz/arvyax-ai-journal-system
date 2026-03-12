import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { JournalController } from '../controllers/journalController.js';

export function createJournalRouter(controller: JournalController) {
  const router = Router();
  const analyzeLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false
  });

  router.post('/', controller.createEntry);
  router.get('/insights/:userId', controller.getInsights);
  router.get('/:userId', controller.listEntries);
  router.post('/analyze', analyzeLimiter, controller.analyzeEntry);

  return router;
}

