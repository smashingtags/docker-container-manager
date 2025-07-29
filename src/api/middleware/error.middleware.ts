import { Request, Response, NextFunction } from 'express';
import { createAPIResponse } from '@/api';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export function errorHandler(
  error: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = error.statusCode || 500;
  const response = createAPIResponse(undefined, {
    code: error.code || 'INTERNAL_ERROR',
    message: error.message || 'An unexpected error occurred',
    details: error.details
  });

  console.error('API Error:', {
    url: req.url,
    method: req.method,
    error: error.message,
    stack: error.stack
  });

  res.status(statusCode).json(response);
}

export function notFoundHandler(req: Request, res: Response): void {
  const response = createAPIResponse(undefined, {
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`
  });

  res.status(404).json(response);
}