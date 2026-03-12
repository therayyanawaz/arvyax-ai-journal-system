import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import { AppError, normalizeError, ValidationError } from '../utils/appError.js';

export function notFoundHandler(_req: Request, res: Response) {
  return res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found.'
    }
  });
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    const validationError = new ValidationError('Request validation failed.');
    return res.status(400).json({
      error: {
        code: validationError.code,
        message: validationError.message
      }
    });
  }

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
