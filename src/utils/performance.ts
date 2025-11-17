// src/utils/performance.ts
// Performance monitoring utilities for database queries and API calls

import { logger } from './logger.js';

interface PerformanceMetrics {
  operation: string;
  duration: number;
  success: boolean;
  metadata?: Record<string, any>;
}

const performanceMetrics: PerformanceMetrics[] = [];
const MAX_METRICS = 1000; // Keep last 1000 metrics in memory

/**
 * Measure the performance of an async operation
 */
export async function measurePerformance<T>(
  operation: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const start = Date.now();
  let success = true;
  
  try {
    const result = await fn();
    const duration = Date.now() - start;
    
    // Log slow operations
    if (duration > 1000) {
      logger.warn('Slow operation detected', {
        operation,
        duration,
        ...metadata,
      });
    }
    
    // Store metric
    performanceMetrics.push({
      operation,
      duration,
      success: true,
      metadata,
    });
    
    // Trim metrics array if it gets too large
    if (performanceMetrics.length > MAX_METRICS) {
      performanceMetrics.shift();
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    success = false;
    
    performanceMetrics.push({
      operation,
      duration,
      success: false,
      metadata,
    });
    
    // Trim metrics array
    if (performanceMetrics.length > MAX_METRICS) {
      performanceMetrics.shift();
    }
    
    throw error;
  }
}

/**
 * Get performance statistics for an operation
 */
export function getPerformanceStats(operation: string): {
  count: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  successRate: number;
} {
  const relevantMetrics = performanceMetrics.filter(m => m.operation === operation);
  
  if (relevantMetrics.length === 0) {
    return {
      count: 0,
      avgDuration: 0,
      minDuration: 0,
      maxDuration: 0,
      successRate: 0,
    };
  }
  
  const durations = relevantMetrics.map(m => m.duration);
  const successful = relevantMetrics.filter(m => m.success).length;
  
  return {
    count: relevantMetrics.length,
    avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
    minDuration: Math.min(...durations),
    maxDuration: Math.max(...durations),
    successRate: (successful / relevantMetrics.length) * 100,
  };
}

/**
 * Get all performance metrics (for debugging/monitoring)
 */
export function getAllPerformanceMetrics(): PerformanceMetrics[] {
  return [...performanceMetrics];
}

/**
 * Clear performance metrics
 */
export function clearPerformanceMetrics(): void {
  performanceMetrics.length = 0;
}

