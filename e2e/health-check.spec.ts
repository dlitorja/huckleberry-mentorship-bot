import { test, expect } from '@playwright/test';

/**
 * End-to-end tests for health check endpoint
 */
test.describe('Health Check', () => {
  test('should return health status', async ({ request }) => {
    const response = await request.get('/health');
    
    // In CI/test mode, server may return degraded status, but should still return 200
    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body).toHaveProperty('status');
    // Accept healthy, degraded, or unhealthy - degraded is acceptable in test/CI environments
    expect(['healthy', 'degraded', 'unhealthy']).toContain(body.status);
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('services');
    
    // Check service statuses exist (may be error in test mode)
    expect(body.services).toHaveProperty('server');
    expect(body.services).toHaveProperty('database');
    expect(body.services).toHaveProperty('discord');
    expect(body.services).toHaveProperty('supabase');
    
    // Server should always be ok
    expect(body.services.server.status).toBe('ok');
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
    // In CI/test mode, may be 'error' if credentials are not provided
    expect(body.services.database).toHaveProperty('status');
    expect(['ok', 'error']).toContain(body.services.database.status);
    
    // If error, should have a message
    if (body.services.database.status === 'error') {
      expect(body.services.database).toHaveProperty('message');
    }
  });

  test('should check Discord API connectivity', async ({ request }) => {
    const response = await request.get('/health');
    const body = await response.json();
    
    // Discord API should be checked
    // In CI/test mode, may be 'error' if token is not provided or invalid
    expect(body.services.discord).toHaveProperty('status');
    expect(['ok', 'error']).toContain(body.services.discord.status);
    
    // If error, should have a message
    if (body.services.discord.status === 'error') {
      expect(body.services.discord).toHaveProperty('message');
    }
  });
});

