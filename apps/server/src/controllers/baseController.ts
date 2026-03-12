import type { Response } from 'express';

import { AppError, normalizeError } from '../utils/appError.js';

export abstract class BaseController {
  protected sendSuccess<T>(res: Response, data: T, statusCode = 200) {
    return res.status(statusCode).json(data);
  }

  protected handleError(error: unknown, res: Response) {
    const normalized = normalizeError(error);

    if (normalized instanceof AppError) {
      return res.status(normalized.statusCode).json({
        error: {
          code: normalized.code,
          message: normalized.message
        }
      });
    }

    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Unexpected server error.'
      }
    });
  }
}
