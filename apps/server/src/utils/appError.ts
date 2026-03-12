import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(message: string, public readonly statusCode: number, public readonly code: string) {
    super(message);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, code = 'BAD_REQUEST') {
    super(message, 400, code);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, code = 'NOT_FOUND') {
    super(message, 404, code);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string, code = 'INTERNAL_SERVER_ERROR') {
    super(message, 500, code);
  }
}

export function normalizeError(error: unknown) {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new ValidationError('Request validation failed.');
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return new InternalServerError('Database request failed.', 'DATABASE_ERROR');
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error('Unexpected error.');
}
