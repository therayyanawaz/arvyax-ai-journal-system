import type { Request, Response } from 'express';

import type { AiProviderRuntime } from '../ai/types.js';
import { BaseController } from './baseController.js';
import { aiProviderSelectionSchema } from '../validators/aiSchemas.js';

export class AiController extends BaseController {
  constructor(private readonly aiRuntime: AiProviderRuntime) {
    super();
  }

  getProviderState = async (_req: Request, res: Response) => {
    try {
      const providers = await this.aiRuntime.listProviders();
      return this.sendSuccess(res, {
        activeProvider: this.aiRuntime.getActiveProviderName(),
        providers
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };

  setProvider = async (req: Request, res: Response) => {
    try {
      const input = aiProviderSelectionSchema.parse(req.body);
      const providers = await this.aiRuntime.setActiveProvider(input.provider);
      return this.sendSuccess(res, {
        activeProvider: this.aiRuntime.getActiveProviderName(),
        providers
      });
    } catch (error) {
      return this.handleError(error, res);
    }
  };
}
