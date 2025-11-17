import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  measurePerformance,
  getPerformanceStats,
  getAllPerformanceMetrics,
  clearPerformanceMetrics,
} from '../performance.js';

// Mock logger
jest.mock('../logger.js', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('performance', () => {
  beforeEach(() => {
    clearPerformanceMetrics();
  });

  describe('measurePerformance', () => {
    it('should measure successful operation', async () => {
      const result = await measurePerformance('test-operation', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'success';
      });

      expect(result).toBe('success');
      const stats = getPerformanceStats('test-operation');
      expect(stats.count).toBe(1);
      expect(stats.successRate).toBe(100);
      expect(stats.avgDuration).toBeGreaterThan(0);
    });

    it('should measure failed operation', async () => {
      await expect(
        measurePerformance('test-operation', async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      const stats = getPerformanceStats('test-operation');
      expect(stats.count).toBe(1);
      expect(stats.successRate).toBe(0);
    });

    it('should track metadata', async () => {
      await measurePerformance('test-operation', async () => 'result', {
        userId: '123',
        action: 'test',
      });

      const metrics = getAllPerformanceMetrics();
      expect(metrics[0]?.metadata).toEqual({
        userId: '123',
        action: 'test',
      });
    });

    it('should limit metrics array size', async () => {
      // Add more than MAX_METRICS (1000)
      for (let i = 0; i < 1001; i++) {
        await measurePerformance('test-operation', async () => 'result');
      }

      const metrics = getAllPerformanceMetrics();
      expect(metrics.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('getPerformanceStats', () => {
    it('should return zero stats for non-existent operation', () => {
      const stats = getPerformanceStats('non-existent');
      expect(stats).toEqual({
        count: 0,
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        successRate: 0,
      });
    });

    it('should calculate correct statistics', async () => {
      // Add multiple operations with different durations
      await measurePerformance('test-op', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'result';
      });
      await measurePerformance('test-op', async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
        return 'result';
      });
      await measurePerformance('test-op', async () => {
        await new Promise(resolve => setTimeout(resolve, 30));
        return 'result';
      });

      const stats = getPerformanceStats('test-op');
      expect(stats.count).toBe(3);
      expect(stats.successRate).toBe(100);
      expect(stats.minDuration).toBeGreaterThan(0);
      expect(stats.maxDuration).toBeGreaterThan(stats.minDuration);
      expect(stats.avgDuration).toBeGreaterThan(stats.minDuration);
      expect(stats.avgDuration).toBeLessThan(stats.maxDuration);
    });

    it('should calculate success rate correctly', async () => {
      // Add 3 successful and 1 failed operation
      await measurePerformance('test-op', async () => 'success');
      await measurePerformance('test-op', async () => 'success');
      await measurePerformance('test-op', async () => 'success');
      await measurePerformance('test-op', async () => {
        throw new Error('Failed');
      }).catch(() => {});

      const stats = getPerformanceStats('test-op');
      expect(stats.count).toBe(4);
      expect(stats.successRate).toBe(75);
    });
  });

  describe('getAllPerformanceMetrics', () => {
    it('should return all metrics', async () => {
      await measurePerformance('op1', async () => 'result1');
      await measurePerformance('op2', async () => 'result2');

      const metrics = getAllPerformanceMetrics();
      expect(metrics.length).toBe(2);
      expect(metrics[0]?.operation).toBe('op1');
      expect(metrics[1]?.operation).toBe('op2');
    });

    it('should return a copy of metrics array', () => {
      const metrics1 = getAllPerformanceMetrics();
      const metrics2 = getAllPerformanceMetrics();
      expect(metrics1).not.toBe(metrics2); // Different array instances
    });
  });

  describe('clearPerformanceMetrics', () => {
    it('should clear all metrics', async () => {
      await measurePerformance('test-op', async () => 'result');
      expect(getAllPerformanceMetrics().length).toBe(1);

      clearPerformanceMetrics();
      expect(getAllPerformanceMetrics().length).toBe(0);
    });
  });
});

