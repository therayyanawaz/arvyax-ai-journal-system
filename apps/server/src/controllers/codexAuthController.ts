import type { Request, Response } from 'express';

import type { CodexAppServerAdapter } from '../ai/codexAppServer/types.js';
import { BaseController } from './baseController.js';
import { NotFoundError } from '../utils/appError.js';
import { loginIdParamSchema } from '../validators/aiSchemas.js';

export class CodexAuthController extends BaseController {
  constructor(private readonly codexClient: CodexAppServerAdapter) {
    super();
  }

  startLogin = async (_req: Request, res: Response) => {
    try {
      const response = await this.codexClient.startChatGptLogin();
      return this.sendSuccess(res, response);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  getLoginStatus = async (req: Request, res: Response) => {
    try {
      const { loginId } = loginIdParamSchema.parse(req.params);
      const status = await this.codexClient.getLoginStatus(loginId);
      if (!status) {
        throw new NotFoundError('Codex login request was not found.', 'LOGIN_NOT_FOUND');
      }

      return this.sendSuccess(res, status);
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  logout = async (_req: Request, res: Response) => {
    try {
      await this.codexClient.logout();
      return this.sendSuccess(res, { success: true });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  getAccount = async (_req: Request, res: Response) => {
    try {
      const account = await this.codexClient.getAccountStatus(false);
      return this.sendSuccess(res, account);
    } catch (error) {
      return this.handleError(error, res);
    }
  };
}
