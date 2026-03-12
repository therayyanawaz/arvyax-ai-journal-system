import { Router } from 'express';

import { CodexAuthController } from '../controllers/codexAuthController.js';

export function createCodexAuthRouter(controller: CodexAuthController) {
  const router = Router();

  router.post('/start', controller.startLogin);
  router.get('/status/:loginId', controller.getLoginStatus);
  router.post('/logout', controller.logout);
  router.get('/account', controller.getAccount);

  return router;
}
