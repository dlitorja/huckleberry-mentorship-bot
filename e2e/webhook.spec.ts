import { test, expect } from '@playwright/test';

/**
 * End-to-end tests for webhook endpoints
 * Note: These tests require proper webhook secret configuration
 */
test.describe('Webhook Endpoints', () => {
  test('should reject webhook without signature', async ({ request }) => {
    const response = await request.post('/webhook/kajabi', {
      data: {
        member: { email: 'test@example.com' },
        offer: { id: '123' },
      },
    });
    
    // Should reject without proper signature
    // Status may be 401 (unauthorized) or 400 (bad request)
    expect([400, 401, 403]).toContain(response.status());
  });

  test('should validate webhook payload structure', async ({ request }) => {
    // Test with invalid email
    const response = await request.post('/webhook/kajabi', {
      data: {
        member: { email: 'invalid-email' },
        offer: { id: '123' },
      },
      headers: {
        'x-webhook-signature': 'test-signature', // Mock signature
      },
    });
    
    // Should return 400 for invalid email
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('should validate required fields', async ({ request }) => {
    // Test with missing email
    const response = await request.post('/webhook/kajabi', {
      data: {
        offer: { id: '123' },
      },
      headers: {
        'x-webhook-signature': 'test-signature',
      },
    });
    
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});

