// src/utils/webhookSecurity.ts
// Webhook signature verification utilities

import crypto from 'crypto';
import { logger } from './logger.js';

/**
 * Verify webhook signature using HMAC SHA-256
 * Most webhook providers (including Kajabi) use this method
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string | null | undefined,
  secret: string
): boolean {
  if (!signature || !secret) {
    return false;
  }

  try {
    // Remove 'sha256=' prefix if present (common in webhook signatures)
    const cleanSignature = signature.replace(/^sha256=/, '');
    
    // Calculate expected signature
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(cleanSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    logger.error('Webhook signature verification error', error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

/**
 * Extract signature from request headers
 * Supports common header formats: X-Webhook-Signature, X-Kajabi-Signature, X-Signature
 */
export function extractSignatureFromHeaders(headers: Record<string, string | string[] | undefined>): string | null {
  const signatureHeader = 
    (headers['x-webhook-signature'] as string) ||
    (headers['x-kajabi-signature'] as string) ||
    (headers['x-signature'] as string) ||
    (headers['x-hub-signature-256'] as string) ||
    null;

  if (Array.isArray(signatureHeader)) {
    return signatureHeader[0] || null;
  }

  return signatureHeader || null;
}

/**
 * Middleware factory for webhook signature verification
 */
export function createWebhookVerificationMiddleware(secretEnvVar: string = 'WEBHOOK_SECRET') {
  return (req: any, res: any, next: any) => {
    const secret = process.env[secretEnvVar];
    const requireVerification = process.env.REQUIRE_WEBHOOK_VERIFICATION === 'true';
    
    if (!secret) {
      if (requireVerification) {
        logger.error('Webhook secret is required but not configured', new Error('Webhook verification not configured'), {
          secretEnvVar,
        });
        return res.status(500).json({ error: 'Webhook verification not configured' });
      }
      logger.warn('Webhook secret not configured. Skipping verification.', {
        secretEnvVar,
      });
      // Allow request to proceed if verification is optional
      return next();
    }

    // Get raw body (Express needs body-parser with verify option to preserve raw body)
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const signature = extractSignatureFromHeaders(req.headers);

    if (!signature) {
      if (requireVerification) {
        logger.error('Webhook request missing signature header (verification required)', new Error('Missing signature'), {
          path: req.path,
        });
        return res.status(401).json({ error: 'Missing webhook signature' });
      }
      logger.warn('Webhook request missing signature header. Allowing request (verification optional).', {
        path: req.path,
        availableHeaders: Object.keys(req.headers).filter(h => 
          h.toLowerCase().includes('signature') || 
          h.toLowerCase().includes('kajabi') ||
          h.toLowerCase().includes('webhook')
        ),
      });
      return next();
    }

    const isValid = verifyWebhookSignature(rawBody, signature, secret);

    if (!isValid) {
      logger.error('Webhook signature verification failed', new Error('Invalid signature'), {
        path: req.path,
        signaturePrefix: signature.substring(0, 20) + '...',
      });
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    logger.debug('Webhook signature verified successfully', { path: req.path });
    next();
  };
}

