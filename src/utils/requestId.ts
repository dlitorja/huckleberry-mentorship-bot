// src/utils/requestId.ts
// Request ID tracking for distributed tracing

import { randomBytes } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { AsyncLocalStorage } from 'async_hooks';

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return randomBytes(16).toString('hex');
}

/**
 * AsyncLocalStorage for request ID context
 * This allows request IDs to be automatically available in all async operations
 */
export const requestIdStorage = new AsyncLocalStorage<string>();

/**
 * Get the current request ID from context
 * Returns undefined if not in a request context
 */
export function getRequestId(): string | undefined {
  return requestIdStorage.getStore();
}

/**
 * Run a function with a request ID context
 * This ensures the request ID is available in all async operations within the callback
 */
export function withRequestId<T>(requestId: string, fn: () => T): T {
  return requestIdStorage.run(requestId, fn);
}

/**
 * Run an async function with a request ID context
 */
export async function withRequestIdAsync<T>(requestId: string, fn: () => Promise<T>): Promise<T> {
  return requestIdStorage.run(requestId, fn);
}

/**
 * Express middleware to generate and track request IDs
 * Adds request ID to request headers and response headers
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Use existing request ID from header if present (for distributed tracing)
  // Otherwise generate a new one
  const requestId = (req.headers['x-request-id'] as string) || generateRequestId();
  
  // Store in request object for easy access
  (req as any).requestId = requestId;
  
  // Add to response headers for client tracking
  res.setHeader('X-Request-ID', requestId);
  
  // Run the rest of the request handling in the request ID context
  withRequestId(requestId, () => {
    next();
  });
}

/**
 * Get request ID from Express request object
 */
export function getRequestIdFromRequest(req: Request): string | undefined {
  return (req as any).requestId || getRequestId();
}

