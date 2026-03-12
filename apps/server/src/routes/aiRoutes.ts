import { Router } from 'express';

import { AiController } from '../controllers/aiController.js';

export function createAiRouter(controller: AiController) {
  const router = Router();

  router.get('/provider', controller.getProviderState);
  router.post('/provider', controller.setProvider);

  return router;
}
