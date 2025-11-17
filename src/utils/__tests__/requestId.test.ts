import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  generateRequestId,
  getRequestId,
  withRequestId,
  withRequestIdAsync,
  requestIdMiddleware,
  getRequestIdFromRequest,
} from '../requestId.js';
import { Request, Response, NextFunction } from 'express';

describe('requestId', () => {
  describe('generateRequestId', () => {
    it('should generate a unique request ID', () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();

      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
      expect(id1.length).toBe(32); // 16 bytes = 32 hex characters
    });
  });

  describe('getRequestId', () => {
    it('should return undefined when not in context', () => {
      expect(getRequestId()).toBeUndefined();
    });

    it('should return request ID when in context', () => {
      const requestId = 'test-request-id';
      withRequestId(requestId, () => {
        expect(getRequestId()).toBe(requestId);
      });
    });
  });

  describe('withRequestId', () => {
    it('should run function with request ID context', () => {
      const requestId = 'test-request-id';
      const result = withRequestId(requestId, () => {
        expect(getRequestId()).toBe(requestId);
        return 'result';
      });

      expect(result).toBe('result');
      expect(getRequestId()).toBeUndefined(); // Context cleared after
    });

    it('should handle nested contexts', () => {
      const outerId = 'outer-id';
      const innerId = 'inner-id';

      withRequestId(outerId, () => {
        expect(getRequestId()).toBe(outerId);

        withRequestId(innerId, () => {
          expect(getRequestId()).toBe(innerId);
        });

        expect(getRequestId()).toBe(outerId); // Back to outer context
      });
    });
  });

  describe('withRequestIdAsync', () => {
    it('should run async function with request ID context', async () => {
      const requestId = 'test-request-id';
      const result = await withRequestIdAsync(requestId, async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        expect(getRequestId()).toBe(requestId);
        return 'async-result';
      });

      expect(result).toBe('async-result');
      expect(getRequestId()).toBeUndefined(); // Context cleared after
    });

    it('should maintain context across async operations', async () => {
      const requestId = 'test-request-id';
      let capturedId: string | undefined;

      await withRequestIdAsync(requestId, async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        capturedId = getRequestId();
      });

      expect(capturedId).toBe(requestId);
    });
  });

  describe('requestIdMiddleware', () => {
    it('should generate new request ID when header is missing', () => {
      const req = {
        headers: {},
      } as unknown as Request;
      const res = {
        setHeader: jest.fn(),
      } as unknown as Response;
      const next = jest.fn() as NextFunction;

      requestIdMiddleware(req, res, next);

      expect((req as any).requestId).toBeTruthy();
      expect((req as any).requestId).toMatch(/^[a-f0-9]{32}$/);
      expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', (req as any).requestId);
      expect(next).toHaveBeenCalled();
    });

    it('should use existing request ID from header', () => {
      const existingId = 'existing-request-id';
      const req = {
        headers: {
          'x-request-id': existingId,
        },
      } as unknown as Request;
      const res = {
        setHeader: jest.fn(),
      } as unknown as Response;
      const next = jest.fn() as NextFunction;

      requestIdMiddleware(req, res, next);

      expect((req as any).requestId).toBe(existingId);
      expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', existingId);
      expect(next).toHaveBeenCalled();
    });

    it('should set request ID in context', () => {
      const req = {
        headers: {},
      } as unknown as Request;
      const res = {
        setHeader: jest.fn(),
      } as unknown as Response;
      let contextId: string | undefined;
      const next = jest.fn(() => {
        contextId = getRequestId();
      }) as NextFunction;

      requestIdMiddleware(req, res, next);

      expect(contextId).toBe((req as any).requestId);
    });
  });

  describe('getRequestIdFromRequest', () => {
    it('should return request ID from request object', () => {
      const requestId = 'test-request-id';
      const req = {
        requestId,
      } as unknown as Request;

      expect(getRequestIdFromRequest(req)).toBe(requestId);
    });

    it('should fall back to context when request object has no ID', () => {
      const requestId = 'context-request-id';
      const req = {
        headers: {},
      } as unknown as Request;

      withRequestId(requestId, () => {
        expect(getRequestIdFromRequest(req)).toBe(requestId);
      });
    });

    it('should return undefined when neither request nor context has ID', () => {
      const req = {
        headers: {},
      } as unknown as Request;

      expect(getRequestIdFromRequest(req)).toBeUndefined();
    });
  });
});

