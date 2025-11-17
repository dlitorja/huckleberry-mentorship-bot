import { test, expect } from '@playwright/test';

/**
 * End-to-end tests for health check endpoint
 */
test.describe('Health Check', () => {
  test('should return healthy status', async ({ request }) => {
    const response = await request.get('/health');
    
    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body).toHaveProperty('status');
    expect(['healthy', 'degraded', 'unhealthy']).toContain(body.status);
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('services');
    
    // Check service statuses
    expect(body.services).toHaveProperty('server');
    expect(body.services).toHaveProperty('database');
    expect(body.services).toHaveProperty('discord');
    expect(body.services).toHaveProperty('supabase');
  });

  test('should include request ID in response', async ({ request }) => {
    const response = await request.get('/health');
    
    expect(response.ok()).toBeTruthy();
    
    // Check for X-Request-ID header
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();
    expect(typeof requestId).toBe('string');
    expect(requestId!.length).toBeGreaterThan(0);
  });

  test('should check database connectivity', async ({ request }) => {
    const response = await request.get('/health');
    const body = await response.json();
    
    // Database should be checked (status may vary based on test environment)
    expect(body.services.database).toHaveProperty('status');
    expect(['ok', 'error']).toContain(body.services.database.status);
  });

  test('should check Discord API connectivity', async ({ request }) => {
    const response = await request.get('/health');
    const body = await response.json();
    
    // Discord API should be checked
    expect(body.services.discord).toHaveProperty('status');
    expect(['ok', 'error']).toContain(body.services.discord.status);
  });
});

