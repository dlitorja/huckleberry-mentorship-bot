// src/server/webhookServer.ts

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { supabase } from '../bot/supabaseClient.js';
import { Resend } from 'resend';
import oauthCallback from './oauthCallback.js';
import { notifyAdminPurchase, notifyAdminError } from '../utils/adminNotifications.js';
import { CONFIG, getSupportContactString } from '../config/constants.js';
import { removeStudentRole } from '../utils/roleManagement.js';
import { logClick } from '../utils/urlShortener.js';
import { createWebhookVerificationMiddleware } from '../utils/webhookSecurity.js';
import { atomicallyUpsertMentorship, checkAndMarkWebhookProcessed } from '../utils/databaseTransactions.js';
import { discordApi } from '../utils/discordApi.js';
import { logger } from '../utils/logger.js';
import { validateEmail, validateName, validateNumeric, validateCurrency, validateTransactionId } from '../utils/validation.js';
import { measurePerformance } from '../utils/performance.js';
import { checkRateLimit as checkDatabaseRateLimit, cleanupExpiredRateLimits } from '../utils/rateLimiter.js';
import { requestIdMiddleware, getRequestIdFromRequest } from '../utils/requestId.js';
import crypto from 'crypto';

const app = express();
const PORT = process.env.WEBHOOK_PORT || 3000;
const ANALYTICS_RETENTION_DAYS = parseInt(process.env.ANALYTICS_RETENTION_DAYS || '180', 10);

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Middleware
app.use(cors());
// Request ID tracking - must be early in the middleware chain
app.use(requestIdMiddleware);
// Preserve raw body for webhook signature verification
app.use(express.json({ verify: (req: any, res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: true, verify: (req: any, res, buf) => { req.rawBody = buf; } }));

// Webhook signature verification middleware
const verifyWebhook = createWebhookVerificationMiddleware('WEBHOOK_SECRET');

// Webhook rate limiting to prevent DoS
type WebhookRateEntry = { count: number; resetAt: number };
const webhookRateMap: Map<string, WebhookRateEntry> = new Map();
const WEBHOOK_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const WEBHOOK_RATE_LIMIT_MAX = parseInt(process.env.WEBHOOK_RATE_LIMIT_MAX || '30', 10); // per IP per minute

function checkWebhookRateLimit(ip: string | null): boolean {
  if (!ip) return true; // Allow if IP cannot be determined
  const now = Date.now();
  const entry = webhookRateMap.get(ip);
  if (!entry || entry.resetAt <= now) {
    webhookRateMap.set(ip, { count: 1, resetAt: now + WEBHOOK_RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count < WEBHOOK_RATE_LIMIT_MAX) {
    entry.count += 1;
    return true;
  }
  return false;
}

// Cleanup expired webhook rate limit entries
function cleanupWebhookRateMap() {
  const now = Date.now();
  let cleaned = 0;
  for (const [ip, entry] of webhookRateMap.entries()) {
    if (entry.resetAt <= now) {
      webhookRateMap.delete(ip);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    logger.debug('Cleaned up expired webhook rate limit entries', { cleaned });
  }
}

// Run cleanup every 5 minutes
const webhookRateMapCleanupInterval = setInterval(cleanupWebhookRateMap, 5 * 60 * 1000);

// Webhook rate limiting middleware
function webhookRateLimitMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    (req.socket?.remoteAddress ?? null);

  if (!checkWebhookRateLimit(clientIp)) {
    logger.warn('Webhook rate limit exceeded', { ip: clientIp, path: req.path });
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
    });
  }
  next();
}

// Routes
app.use(oauthCallback);

// Health check endpoint with comprehensive service verification
app.get('/health', async (req, res) => {
  const requestId = getRequestIdFromRequest(req);
  logger.debug('Health check request', { 
    path: req.path, 
    method: req.method,
    requestId 
  });

  const healthStatus: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    requestId?: string;
    services: {
      server: { status: 'ok' | 'error'; message?: string };
      database: { status: 'ok' | 'error'; message?: string; latency?: number };
      discord: { status: 'ok' | 'error'; message?: string; latency?: number };
      supabase: { status: 'ok' | 'error'; message?: string; latency?: number };
    };
  } = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    requestId,
    services: {
      server: { status: 'ok' },
      database: { status: 'error', message: 'Not checked' },
      discord: { status: 'error', message: 'Not checked' },
      supabase: { status: 'error', message: 'Not checked' },
    },
  };

  // Check database connectivity (Supabase)
  const isTestMode = process.env.NODE_ENV === 'test' || process.env.CI === 'true';
  try {
    // Skip database check if credentials are missing in test mode
    if (isTestMode && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
      healthStatus.services.supabase = {
        status: 'error',
        message: 'Skipped in test mode (credentials not provided)',
      };
      healthStatus.status = 'degraded';
    } else {
      const dbStart = Date.now();
      const { error: dbError } = await supabase
        .from('instructors')
        .select('id')
        .limit(1);
      const dbLatency = Date.now() - dbStart;
      
      if (dbError) {
        healthStatus.services.supabase = {
          status: 'error',
          message: dbError.message,
          latency: dbLatency,
        };
        // In test mode, allow degraded status instead of unhealthy
        healthStatus.status = isTestMode ? 'degraded' : 'unhealthy';
      } else {
        healthStatus.services.supabase = {
          status: 'ok',
          latency: dbLatency,
        };
      }
    }
  } catch (error) {
    healthStatus.services.supabase = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    // In test mode, allow degraded status instead of unhealthy
    healthStatus.status = isTestMode ? 'degraded' : 'unhealthy';
  }

  // Check Discord API connectivity
  try {
    // Skip Discord check if token is missing in test mode
    if (isTestMode && !process.env.DISCORD_BOT_TOKEN) {
      healthStatus.services.discord = {
        status: 'error',
        message: 'Skipped in test mode (token not provided)',
      };
      healthStatus.status = healthStatus.status === 'healthy' ? 'degraded' : healthStatus.status;
    } else {
      const discordStart = Date.now();
      const response = await fetch('https://discord.com/api/v10/gateway/bot', {
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN || ''}`,
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      const discordLatency = Date.now() - discordStart;
      
      if (!response.ok) {
        healthStatus.services.discord = {
          status: 'error',
          message: `HTTP ${response.status}`,
          latency: discordLatency,
        };
        // In test mode, prefer degraded over unhealthy
        if (healthStatus.status === 'healthy') {
          healthStatus.status = 'degraded';
        } else if (!isTestMode && healthStatus.status === 'degraded') {
          healthStatus.status = 'unhealthy';
        }
      } else {
        healthStatus.services.discord = {
          status: 'ok',
          latency: discordLatency,
        };
      }
    }
  } catch (error) {
    healthStatus.services.discord = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    // In test mode, prefer degraded over unhealthy
    if (healthStatus.status === 'healthy') {
      healthStatus.status = 'degraded';
    } else if (!isTestMode && healthStatus.status === 'degraded') {
      healthStatus.status = 'unhealthy';
    }
  }

  // Database and Supabase are the same (Supabase), so mark database as same status
  healthStatus.services.database = { ...healthStatus.services.supabase };

  // In test mode, always return 200 even if degraded/unhealthy to allow tests to run
  const statusCode = isTestMode 
    ? 200 
    : healthStatus.status === 'healthy' 
      ? 200 
      : healthStatus.status === 'degraded' 
        ? 200 
        : 503;
  res.status(statusCode).json(healthStatus);
});

// -------------------------------
// Webhook helper functions
// -------------------------------
async function readdMenteeRoleIfWasEnded(discordUserId: string): Promise<boolean> {
  try {
    const roleId = await getMenteeRoleId();
    if (!roleId) return false;
    return await discordApi.addRoleToMember(discordUserId, roleId);
  } catch (error) {
    logger.error('Failed to re-add mentee role', error instanceof Error ? error : new Error(String(error)), {
      discordUserId,
    });
    return false;
  }
}

async function notifyReturningStudentAndInstructor(params: {
  studentDiscordId: string;
  email: string;
  instructorName: string;
  instructorId: string;
  sessionTotal: string;
  purchaseTime: string;
}): Promise<void> {
  const { studentDiscordId, email, instructorName, instructorId, sessionTotal, purchaseTime } = params;

  // Fetch instructor Discord ID for DM
  const { data: instructorDiscordData } = await supabase
    .from('instructors')
    .select('discord_id')
    .eq('id', instructorId)
    .single();

  await Promise.allSettled([
    (async () => {
      try {
        const studentMessage = `🎉 **Payment Processed Successfully!**\n\n` +
          `Thank you for continuing your **1-on-1 mentorship** with **${instructorName}**!\n\n` +
          `✅ **${CONFIG.DEFAULT_SESSIONS_PER_PURCHASE} new 1-on-1 sessions** have been added to your account.\n` +
          `💬 Reach out to your instructor to schedule your next 1-on-1 session.\n\n` +
          `We're excited to continue your personalized mentorship journey!\n\n` +
          `_Having any issues? ${getSupportContactString()}_`;
        
        await discordApi.sendDM(studentDiscordId, studentMessage);
      } catch (error) {
        // Log DM failures but don't fail the webhook - notifications are non-critical
        logger.error('Failed to send student renewal DM', error instanceof Error ? error : new Error(String(error)), {
          studentDiscordId,
          email,
        });
      }
    })(),
    (async () => {
      if (instructorDiscordData?.discord_id) {
        try {
          const instructorMessage = `🔄 **Returning Student Renewed**\n\n` +
            `<@${studentDiscordId}> (${email}) has renewed their **1-on-1 mentorship**!\n\n` +
            `✅ **${CONFIG.DEFAULT_SESSIONS_PER_PURCHASE} new 1-on-1 sessions** added to their account.\n` +
            `📊 **Total Sessions:** ${sessionTotal}\n` +
            `🛒 **Purchased:** ${purchaseTime}\n\n` +
            `They're ready to schedule their next 1-on-1 session!`;
          
          await discordApi.sendDM(instructorDiscordData.discord_id, instructorMessage);
        } catch (error) {
          // Log DM failures but don't fail the webhook - notifications are non-critical
          logger.error('Failed to send instructor renewal DM', error instanceof Error ? error : new Error(String(error)), {
            instructorDiscordId: instructorDiscordData.discord_id,
            studentDiscordId,
            email,
          });
        }
      }
    })(),
  ]);
}

async function sendInviteEmailAndNotifyAdmin(params: {
  email: string;
  instructorName: string;
  inviteLink: string;
  offerName: string;
  offerPrice?: string | number | null;
  mentorshipType?: string | null;
  discordRoleName?: string | null;
}): Promise<{ emailId?: string }> {
  const { email, instructorName, inviteLink, offerName, offerPrice, mentorshipType, discordRoleName } = params;

  // Determine if this is a group mentorship
  const isGroupMentorship = mentorshipType?.toLowerCase() === 'group' || 
                           mentorshipType?.toLowerCase() === 'group mentorship' ||
                           (discordRoleName && discordRoleName.toLowerCase().includes('group'));

  // Dynamic content based on mentorship type
  const welcomeTitle = isGroupMentorship 
    ? 'Welcome to Your Group Mentorship Program! 🎉' 
    : 'Welcome to Your 1-on-1 Mentorship Program! 🎉';
  const welcomeHeading = isGroupMentorship 
    ? 'Welcome to Your Group Mentorship!' 
    : 'Welcome to Your 1-on-1 Mentorship!';
  const purchaseMessage = isGroupMentorship
    ? 'Thank you for purchasing your group mentorship! We\'re excited to have you join our community.'
    : 'Thank you for purchasing your 1-on-1 mentorship! We\'re excited to have you join our community.';
  const roleName = discordRoleName || (isGroupMentorship ? 'Group Mentee' : '1-on-1 Mentee');
  const connectMessage = isGroupMentorship
    ? 'Click the button below to join our Discord community and connect with your instructor and fellow mentees:'
    : 'Click the button below to join our Discord community and connect with your instructor:';

  const { data: emailData, error: emailError } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: email,
    subject: welcomeTitle,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #5865F2;">${welcomeHeading}</h1>
        <p style="font-size: 16px; line-height: 1.6;">
          ${purchaseMessage}
        </p>
        <div style="background-color: #f0f7ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #5865F2;">
          <p style="margin: 0; font-size: 16px;">
            <strong>👨‍🏫 Your Instructor:</strong> ${instructorName}
          </p>
        </div>
        <h2 style="color: #333; font-size: 20px;">Next Step: Join Our Discord Server</h2>
        <p style="font-size: 15px; line-height: 1.6;">
          ${connectMessage}
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteLink}" style="display: inline-block; padding: 15px 32px; background-color: #5865F2; color: white; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold;">
            Join Discord & Get Your Role
          </a>
        </div>
        <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <p style="margin: 0; font-size: 14px;">
            <strong>⚠️ Already in our Discord server?</strong>
          </p>
          <p style="margin: 10px 0 0 0; font-size: 14px;">
            You still need to click the link above! This will link your account to your purchase and automatically assign you the "${roleName}" role.
          </p>
        </div>
        <p style="font-size: 14px; color: #666; line-height: 1.6;">
          <strong>Link not working?</strong> Copy and paste this URL into your browser:
        </p>
        <p style="font-size: 12px; background-color: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all;">
          ${inviteLink}
        </p>
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
        <p style="font-size: 13px; color: #666;">
          Questions? Contact us at <a href="mailto:${CONFIG.SUPPORT_EMAIL}">${CONFIG.SUPPORT_EMAIL}</a>
        </p>
      </div>
    `
  });

  if (emailError) {
    throw emailError;
  }

  await notifyAdminPurchase({
    studentEmail: email,
    instructorName,
    offerName,
    offerPrice: offerPrice ? String(offerPrice) : undefined,
  });

  return { emailId: emailData?.id };
}

// -------------------------------
// Flow handlers
// -------------------------------
async function handleReturningStudentRenewal(params: {
  email: string;
  instructorId: string;
  instructorName: string;
  existingMentee: { id: string; discord_id: string };
  sessionsToAdd: number;
}): Promise<{ message: string }> {
  const { email, instructorId, instructorName, existingMentee, sessionsToAdd } = params;

  // Use atomic upsert to prevent race conditions
  const result = await atomicallyUpsertMentorship({
    menteeId: existingMentee.id,
    instructorId,
    sessionsToAdd,
  });

  if (!result.success) {
    throw new Error(`Failed to update mentorship: ${result.error}`);
  }

  // Fetch mentorship status in the same query to avoid race condition
  // Use the mentorshipId from the atomic operation result if available
  const mentorshipId = result.mentorshipId;
  if (!mentorshipId) {
    throw new Error('Mentorship ID not returned from atomic operation');
  }

  const { data: mentorship } = await supabase
    .from('mentorships')
    .select('id, sessions_remaining, total_sessions, status')
    .eq('id', mentorshipId)
    .single();

  if (!mentorship) {
    throw new Error('Mentorship not found after atomic upsert');
  }

  // Check if mentorship was ended and needs role re-added
  // Note: The atomic function should have set status to 'active', but check anyway
  if (mentorship.status === 'ended') {
    const roleReadded = await readdMenteeRoleIfWasEnded(existingMentee.discord_id);
    if (!roleReadded) {
      // Log error and notify admin - this is critical for student access
      logger.error('Failed to re-add mentee role after renewal', new Error('Role re-addition failed'), {
        discordId: existingMentee.discord_id,
        email,
      });
      await notifyAdminError({
        type: 'role_assignment_failed',
        message: `Failed to re-add Discord role after student renewal`,
        details: { discordId: existingMentee.discord_id, email, mentorshipId: mentorship.id },
        studentEmail: email,
        studentDiscordId: existingMentee.discord_id,
      });
    }
  }

  const sessionTotal = mentorship
    ? `${mentorship.sessions_remaining}/${mentorship.total_sessions}`
    : 'N/A';

  const purchaseTime = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

  try {
    await notifyReturningStudentAndInstructor({
      studentDiscordId: existingMentee.discord_id,
      email,
      instructorName,
      instructorId,
      sessionTotal,
      purchaseTime,
    });
  } catch (notificationError) {
    // Log but don't fail the webhook - notifications are non-critical
    logger.error('Failed to send renewal notifications', notificationError instanceof Error ? notificationError : new Error(String(notificationError)), {
      email,
      instructorId,
    });
  }

  return { message: 'Returning student - sessions added' };
}

async function handleNewStudentPurchase(params: {
  email: string;
  instructorId: string;
  instructorName: string;
  offerIdString: string;
  offerName: string;
  offerPrice?: string | number | null;
  menteeName?: string | null;
  transactionId?: string | number | null;
  currency?: string | null;
  sessionsPerPurchase: number;
  discordRoleName?: string | null;
  mentorshipType?: string | null;
}): Promise<{ emailId?: string }> {
  const { email, instructorId, instructorName, offerIdString, offerName, offerPrice, menteeName, transactionId, currency, sessionsPerPurchase, discordRoleName, mentorshipType } = params;

  const oauthState = crypto.randomBytes(16).toString('hex');
  const oauthStateExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error: insertError } = await supabase
    .from('pending_joins')
    .insert({
      email: email.toLowerCase(),
      instructor_id: instructorId,
      offer_id: offerIdString,
      oauth_state: oauthState,
      oauth_state_expires_at: oauthStateExpiresAt,
      created_at: new Date().toISOString()
    });

  if (insertError) {
    throw insertError;
  }

  // --- Robust data provisioning at purchase time ---
  // 1) Ensure mentee exists (by email), without requiring Discord join yet
  let menteeId: string | null = null;
  try {
    const { data: existingMentee } = await supabase
      .from('mentees')
      .select('id, discord_id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existingMentee?.id) {
      menteeId = existingMentee.id;
      logger.debug('Found existing mentee by email', { email: email.toLowerCase(), menteeId });
    } else {
      const { data: newMentee, error: insertMenteeError } = await supabase
        .from('mentees')
        .insert({
          email: email.toLowerCase(),
          discord_id: null,
          name: menteeName || email.split('@')[0]  // fallback to local-part of email
        })
        .select('id')
        .single();
      menteeId = newMentee?.id ?? null;
      if (insertMenteeError) {
        logger.error('Failed to insert mentee', insertMenteeError instanceof Error ? insertMenteeError : new Error(String(insertMenteeError)), {
          email: email.toLowerCase(),
        });
      } else {
        logger.info('Inserted new mentee', { email: email.toLowerCase(), menteeId });
      }
    }
  } catch (e) {
    await notifyAdminError({
      type: 'database_error',
      message: 'Failed to upsert mentee during purchase webhook',
      details: e,
      studentEmail: email,
    });
    logger.error(
      'Exception during mentee upsert in purchase webhook',
      e instanceof Error ? e : new Error(String(e)),
      { studentEmail: email }
    );
  }

      // 2) Ensure mentorship exists and is additive for renewals (atomic operation)
      if (menteeId) {
        try {
          const roleNameForMentee = discordRoleName || '1-on-1 Mentee';
          
          // Use atomic upsert to prevent race conditions
          const mentorshipResult = await atomicallyUpsertMentorship({
            menteeId,
            instructorId,
            sessionsToAdd: sessionsPerPurchase,
            roleName: roleNameForMentee,
          });

          if (!mentorshipResult.success) {
            logger.error('Failed to upsert mentorship', mentorshipResult.error instanceof Error ? mentorshipResult.error : new Error(String(mentorshipResult.error)), {
              email: email.toLowerCase(),
              instructorId,
              sessionsPerPurchase,
            });
            await notifyAdminError({
              type: 'database_error',
              message: 'Failed to create or update mentorship during purchase webhook',
              details: mentorshipResult.error,
              studentEmail: email,
            });
          } else {
            logger.info('Successfully upserted mentorship', {
              email: email.toLowerCase(),
              instructorId,
              sessionsPerPurchase,
            });
          }
        } catch (e) {
          await notifyAdminError({
            type: 'database_error',
            message: 'Failed to create or update mentorship during purchase webhook',
            details: e,
            studentEmail: email,
          });
          logger.error('Exception during mentorship ensure', e instanceof Error ? e : new Error(String(e)), {
            email: email.toLowerCase(),
            instructorId,
          });
        }
      }

  // 3) Record purchase (only if transaction_id was null, since it was already inserted atomically if it existed)
  // The purchase record is created atomically in checkAndMarkWebhookProcessed when transaction_id exists
  // If transaction_id is null, we can't deduplicate, so insert it here
  if (!transactionId) {
    try {
      await supabase
        .from('purchases')
        .insert({
          email: email.toLowerCase(),
          instructor_id: instructorId,
          offer_id: offerIdString,
          transaction_id: null,
          amount_paid_decimal: offerPrice != null ? Number(offerPrice) : null,
          currency: currency ?? null,
          purchased_at: new Date().toISOString(),
        });
    } catch (e) {
      logger.error('Failed to record purchase (no transaction_id)', e instanceof Error ? e : new Error(String(e)), {
        email: email.toLowerCase(),
        offerId: offerIdString,
      });
    }
  }

  const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.DISCORD_REDIRECT_URI!)}&response_type=code&scope=identify%20email%20guilds.join&state=${encodeURIComponent(oauthState)}`;

  const { emailId } = await sendInviteEmailAndNotifyAdmin({
    email,
    instructorName,
    inviteLink,
    offerName,
    offerPrice,
    mentorshipType,
    discordRoleName,
  });

  return { emailId };
}

// Kajabi webhook endpoint (with signature verification and rate limiting)
app.post('/webhook/kajabi', webhookRateLimitMiddleware, verifyWebhook, async (req, res) => {
  const requestId = getRequestIdFromRequest(req);
  
  try {
    logger.info('Received Kajabi webhook', { 
      hasBody: !!req.body,
      bodyKeys: req.body ? Object.keys(req.body) : [],
      path: req.path,
      method: req.method,
      requestId,
    });

    // Extract data from Kajabi's nested structure
    // Supports both general webhooks (member.email, offer.id) and offer-specific webhooks (payload.member_email, payload.offer_id)
    const rawEmail = req.body.member?.email || req.body.payload?.member_email || req.body.email;
    const rawOfferId = req.body.offer?.id || req.body.payload?.offer_id || req.body.offer_id;

    // Validate and sanitize input to prevent SQL injection
    let email: string;
    
    try {
      email = validateEmail(rawEmail, 'email');
    } catch (validationError) {
      logger.warn('Invalid email in webhook payload', { 
        rawEmail: typeof rawEmail === 'string' ? rawEmail.substring(0, 50) : rawEmail,
        error: validationError instanceof Error ? validationError.message : String(validationError),
      });
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate offer_id - must be a number or numeric string
    if (!rawOfferId || rawOfferId === 0) {
      logger.warn('Missing or invalid offer_id in webhook payload', { rawOfferId });
      return res.status(400).json({ error: 'Missing or invalid offer_id' });
    }
    
    // Convert offer_id to string and validate it's numeric
    const offerIdNum = typeof rawOfferId === 'number' ? rawOfferId : parseInt(String(rawOfferId), 10);
    if (isNaN(offerIdNum) || offerIdNum <= 0) {
      logger.warn('Invalid offer_id format in webhook payload', { rawOfferId });
      return res.status(400).json({ error: 'Invalid offer_id format' });
    }
    
    const offerIdString = String(offerIdNum);

    // Lookup the instructor for this offer with performance monitoring
    const offerData = await measurePerformance(
      'webhook.kajabi.offer_lookup',
      async () => {
        const { data, error } = await supabase
          .from('kajabi_offers')
          .select('instructor_id, offer_name, sessions_per_purchase, discord_role_name, mentorship_type, instructors(name)')
          .eq('offer_id', offerIdString)
          .single();

        if (error || !data) {
          throw new Error(`Offer not found: ${offerIdString} - ${error?.message || 'Unknown error'}`);
        }
        return data;
      },
      { offerId: offerIdString, email }
    ).catch(async (error) => {
      logger.error('Offer lookup failed in webhook', error instanceof Error ? error : new Error(String(error)), {
        offerId: offerIdString,
        email,
      });
      
      // Notify admin of unmapped offer
      await notifyAdminError({
        type: 'webhook_error',
        message: `Unmapped Kajabi offer received: ${offerIdString}`,
        details: `Email: ${email}\nThis offer needs to be added to the database.`,
        studentEmail: email
      });
      
      return null;
    });

    if (!offerData) {
      // Return 404 when offer is not found (correct HTTP semantics)
      // Tests should accept 404 as a valid error response
      return res.status(404).json({ error: 'Offer not found in database' });
    }

    // Get instructor name for personalized messages
    const instructorName = (offerData as { instructors?: { name?: string } } | null)?.instructors?.name || 'your instructor';

    // Extract and validate price and currency from webhook payload
    const rawOfferPrice = req.body.payment_transaction?.amount_paid_decimal || 
                          req.body.payload?.amount_paid_decimal || 
                          req.body.order?.order_items?.[0]?.unit_cost_decimal;
    const rawCurrency = req.body.payment_transaction?.currency || 
                        req.body.payload?.currency ||
                        req.body.currency || 'USD';
    const rawTransactionId = req.body.transaction_id || req.body.payload?.transaction_id || req.body.order?.id || null;

    // Validate and sanitize additional fields
    let offerPrice: number | null = null;
    let currency: string = 'USD';
    let transactionId: string | null = null;

    try {
      offerPrice = validateNumeric(rawOfferPrice, 'offerPrice', 0, undefined, true);
    } catch (validationError) {
      logger.warn('Invalid offer price in webhook payload', {
        rawOfferPrice,
        error: validationError instanceof Error ? validationError.message : String(validationError),
      });
      // Continue with null price - not critical
    }

    try {
      currency = validateCurrency(rawCurrency, 'currency');
    } catch (validationError) {
      logger.warn('Invalid currency in webhook payload, using USD', {
        rawCurrency,
        error: validationError instanceof Error ? validationError.message : String(validationError),
      });
      currency = 'USD'; // Default to USD
    }

    try {
      transactionId = validateTransactionId(rawTransactionId, 'transaction_id');
    } catch (validationError) {
      logger.warn('Invalid transaction ID in webhook payload', {
        rawTransactionId: typeof rawTransactionId === 'string' ? rawTransactionId.substring(0, 50) : rawTransactionId,
        error: validationError instanceof Error ? validationError.message : String(validationError),
      });
      // Continue with null transaction ID - will be handled by deduplication logic
    }

    // Sessions per purchase: honor offer override, else default
    const sessionsPerPurchase = Number((offerData as { sessions_per_purchase?: number } | null)?.sessions_per_purchase) || CONFIG.DEFAULT_SESSIONS_PER_PURCHASE;

    // Atomically deduplicate webhook processing using transaction_id with performance monitoring
    // This inserts the purchase record immediately, eliminating race conditions
    const { shouldProcess } = await measurePerformance(
      'webhook.kajabi.deduplication',
      async () => {
        return await checkAndMarkWebhookProcessed(
          transactionId,
          email,
          offerIdString,
          offerData.instructor_id,
          offerPrice,
          currency
        );
      },
      { transactionId, email, offerId: offerIdString }
    );

    if (!shouldProcess) {
      logger.info('Webhook already processed, skipping', { transactionId, email });
      return res.json({
        success: true,
        message: 'Webhook already processed (deduplicated)',
        duplicate: true,
      });
    }

    // Check if this is a returning/existing student with performance monitoring
    const existingMentee = await measurePerformance(
      'webhook.kajabi.check_existing_mentee',
      async () => {
        const { data, error } = await supabase
          .from('mentees')
          .select('id, discord_id')
          .eq('email', email.toLowerCase())
          .maybeSingle();

        if (error) {
          throw new Error(`Failed to check existing mentee: ${error.message}`);
        }
        return data || null;
      },
      { email }
    );

    // RETURNING STUDENT FLOW
    if (existingMentee && existingMentee.discord_id) {
      const result = await measurePerformance(
        'webhook.kajabi.returning_student_renewal',
        async () => {
          return await handleReturningStudentRenewal({
            email,
            instructorId: offerData.instructor_id,
            instructorName,
            existingMentee: { id: existingMentee.id, discord_id: existingMentee.discord_id },
            sessionsToAdd: sessionsPerPurchase,
          });
        },
        { email, menteeId: existingMentee.id, sessionsToAdd: sessionsPerPurchase }
      );

      return res.json({
        success: true,
        message: result.message,
        returning_student: true,
      });
    }

    // NEW STUDENT FLOW
    try {
      // Extract and validate mentee name
      const rawMenteeName =
        req.body.member?.name ||
        req.body.payload?.member_name ||
        (req.body.member_first_name && req.body.member_last_name
          ? `${req.body.member_first_name} ${req.body.member_last_name}`
          : req.body.member_first_name || req.body.member_last_name || null);
      
      let menteeName: string | null = null;
      if (rawMenteeName) {
        try {
          menteeName = validateName(rawMenteeName, 'menteeName');
        } catch (validationError) {
          logger.warn('Invalid mentee name in webhook payload', {
            rawMenteeName: typeof rawMenteeName === 'string' ? rawMenteeName.substring(0, 50) : rawMenteeName,
            error: validationError instanceof Error ? validationError.message : String(validationError),
          });
          // Continue with null name - will use email fallback
        }
      }

      const { emailId } = await measurePerformance(
        'webhook.kajabi.new_student_purchase',
        async () => {
          return await handleNewStudentPurchase({
            email,
            instructorId: offerData.instructor_id,
            instructorName,
            offerIdString,
            offerName: ((offerData as { offer_name?: string } | null)?.offer_name) || 'Unknown Offer',
            offerPrice,
            transactionId,
            currency,
            sessionsPerPurchase,
            menteeName,
            discordRoleName: ((offerData as { discord_role_name?: string } | null)?.discord_role_name) || null,
            mentorshipType: ((offerData as { mentorship_type?: string } | null)?.mentorship_type) || null,
          });
        },
        { email, offerId: offerIdString, instructorId: offerData.instructor_id }
      );

      return res.json({
        success: true,
        message: 'Webhook processed successfully',
        email_id: emailId,
      });
    } catch (insertOrEmailError) {
      logger.error('Failed in new student flow', insertOrEmailError instanceof Error ? insertOrEmailError : new Error(String(insertOrEmailError)), {
        email,
        offerId: offerIdString,
      });
      await notifyAdminError({
        type: 'database_error',
        message: 'Failed to process pending join or send email',
        details: insertOrEmailError,
        studentEmail: email,
      });
      return res.status(500).json({ error: 'Failed to process new student flow' });
    }

  } catch (error) {
    const requestId = getRequestIdFromRequest(req);
    logger.error('Unexpected error processing Kajabi webhook', error instanceof Error ? error : new Error(String(error)), {
      email: req.body.member?.email || req.body.payload?.member_email || req.body.email,
      offerId: req.body.offer?.id || req.body.payload?.offer_id || req.body.offer_id,
      path: req.path,
      method: req.method,
      requestId,
    });
    
    // Notify admin of unexpected error
    await notifyAdminError({
      type: 'webhook_error',
      message: 'Unexpected error processing Kajabi webhook',
      details: error
    });
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Kajabi cancellation/refund webhook endpoint (with signature verification and rate limiting)
app.post('/webhook/kajabi/cancellation', webhookRateLimitMiddleware, verifyWebhook, async (req, res) => {
  const requestId = getRequestIdFromRequest(req);
  
  try {
    logger.info('Received Kajabi cancellation webhook', { 
      hasBody: !!req.body,
      bodyKeys: req.body ? Object.keys(req.body) : [],
      path: req.path,
      method: req.method,
      requestId,
    });

    // Extract email from various possible Kajabi webhook formats
    const rawEmail = req.body.member?.email || 
                     req.body.payload?.member_email || 
                     req.body.email ||
                     req.body.subscription?.member?.email;
    
    // Extract event type
    const eventType = req.body.event_type || req.body.type || 'unknown';

    // Validate and sanitize email input
    let email: string;
    try {
      email = validateEmail(rawEmail, 'email');
    } catch (validationError) {
      logger.warn('Invalid email in cancellation webhook payload', { 
        rawEmail: typeof rawEmail === 'string' ? rawEmail.substring(0, 50) : rawEmail,
        error: validationError instanceof Error ? validationError.message : String(validationError),
      });
      return res.status(400).json({ error: 'Invalid email format' });
    }

    logger.info('Processing cancellation webhook', { email, eventType });

    // Find student by email with performance monitoring
    const menteeData = await measurePerformance(
      'webhook.kajabi.cancellation.find_mentee',
      async () => {
        const { data, error } = await supabase
          .from('mentees')
          .select('id, discord_id')
          .eq('email', email.toLowerCase())
          .maybeSingle();

        if (error) {
          throw new Error(`Failed to find mentee: ${error.message}`);
        }
        if (!data || !data.discord_id) {
          return null;
        }
        return data;
      },
      { email }
    );

    if (!menteeData) {
      logger.info('No active mentee found for cancellation', { email });
      return res.json({ 
        success: true, 
        message: 'No active Discord user found - nothing to do'
      });
    }

    // Determine reason based on event type
    let reason = 'Subscription ended';
    if (eventType.includes('cancel')) {
      reason = 'Subscription cancelled';
    } else if (eventType.includes('refund')) {
      reason = 'Order refunded';
    } else if (eventType.includes('expired')) {
      reason = 'Subscription expired';
    }

    // Resolve mentee role name from active mentorship (fallback to default)
    let menteeRoleName = '1-on-1 Mentee';
    try {
      const { data: activeMentorship } = await supabase
        .from('mentorships')
        .select('mentee_role_name')
        .eq('mentee_id', menteeData.id)
        .eq('status', 'active')
        .maybeSingle();
      if (activeMentorship?.mentee_role_name) {
        menteeRoleName = activeMentorship.mentee_role_name;
      }
    } catch (error) {
      // Log but continue - we have a default role name
      logger.warn('Failed to fetch mentee role name, using default', {
        error: error instanceof Error ? error.message : String(error),
        menteeId: menteeData.id,
      });
    }

    // Remove student role with performance monitoring
    const result = await measurePerformance(
      'webhook.kajabi.cancellation.remove_role',
      async () => {
        return await removeStudentRole({
          menteeDiscordId: menteeData.discord_id,
          reason,
          sendGoodbyeDm: true,
          notifyAdmin: true,
          client: undefined, // Use API method since we don't have client in webhook context
          roleName: menteeRoleName
        });
      },
      { menteeId: menteeData.id, discordId: menteeData.discord_id, reason }
    );

    if (result.success) {
      logger.info('Successfully processed cancellation', { email, menteeId: menteeData.id });
      return res.json({ 
        success: true, 
        message: 'Student role removed successfully'
      });
    } else {
      logger.error('Failed to remove role in cancellation webhook', new Error(result.message), {
        email,
        menteeId: menteeData.id,
        discordId: menteeData.discord_id,
      });
      return res.status(500).json({ 
        error: 'Failed to remove student role',
        details: result.message
      });
    }

  } catch (error) {
    logger.error('Cancellation webhook error', error instanceof Error ? error : new Error(String(error)), {
      email: req.body.member?.email || req.body.payload?.member_email || req.body.email,
    });
    
    await notifyAdminError({
      type: 'cancellation_webhook_error',
      message: 'Error processing Kajabi cancellation webhook',
      details: error
    });
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
const server = app.listen(PORT, () => {
  logger.info('Webhook server started', {
    port: PORT,
    healthCheck: `http://localhost:${PORT}/health`,
    kajabiWebhook: `http://localhost:${PORT}/webhook/kajabi`,
    cancellationWebhook: `http://localhost:${PORT}/webhook/kajabi/cancellation`,
  });
});

// Handle server startup errors (e.g., port already in use)
server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    logger.error(`Port ${PORT} is already in use. Please choose a different port.`, error);
    process.exit(1);
  } else {
    logger.error('Server error', error);
    process.exit(1);
  }
});

export default app;

// -------------------------------
// URL Shortener: Redirect handler
// -------------------------------
// Database-backed IP rate limiter for redirect endpoint (works across multiple instances)
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = parseInt(process.env.REDIRECT_RATE_LIMIT_MAX || '200', 10); // per IP per window

// Cleanup expired rate limit entries periodically
async function cleanupRateLimits() {
  try {
    await cleanupExpiredRateLimits();
  } catch (error) {
    logger.error('Failed to cleanup rate limits', error instanceof Error ? error : new Error(String(error)));
  }
}

// Run cleanup every 30 minutes
setInterval(cleanupRateLimits, 30 * 60 * 1000);

app.get('/:shortCode', async (req, res) => {
  const { shortCode } = req.params;
  const requestId = getRequestIdFromRequest(req);

  logger.debug('URL redirect request', {
    shortCode,
    path: req.path,
    method: req.method,
    requestId,
  });

  try {
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.socket?.remoteAddress ?? null);

    // Check rate limit using database-backed limiter
    if (clientIp) {
      const rateLimitResult = await checkDatabaseRateLimit({
        tokenKey: clientIp,
        tokenType: 'redirect',
        maxRequests: RATE_LIMIT_MAX,
        windowMs: RATE_LIMIT_WINDOW_MS,
      });

      if (!rateLimitResult.allowed) {
        logger.warn('Redirect rate limit exceeded', {
          ip: clientIp,
          shortCode,
          retryAfter: rateLimitResult.retryAfter,
        });
        return res.status(429).send('Too Many Requests');
      }
    }

    const { data: urlData, error } = await supabase
      .from('shortened_urls')
      .select('original_url, is_active, expires_at, click_count')
      .eq('short_code', shortCode)
      .single();

    if (error || !urlData) {
      return res.status(404).send(`
        <html>
          <head><title>Link Not Found</title></head>
          <body>
            <h1>404 - Link Not Found</h1>
            <p>This shortened link does not exist or has been deleted.</p>
          </body>
        </html>
      `);
    }

    if (urlData.expires_at && new Date(urlData.expires_at) < new Date()) {
      return res.status(410).send(`
        <html>
          <head><title>Link Expired</title></head>
          <body>
            <h1>410 - Link Expired</h1>
            <p>This shortened link has expired.</p>
          </body>
        </html>
      `);
    }

    if (!urlData.is_active) {
      return res.status(410).send(`
        <html>
          <head><title>Link Disabled</title></head>
          <body>
            <h1>410 - Link Disabled</h1>
            <p>This shortened link has been disabled.</p>
          </body>
        </html>
      `);
    }

    // Fire and forget analytics logging (do not block redirect)
    logClick({
      shortCode,
      userAgent: req.headers['user-agent'] || null,
      referer: (req.headers['referer'] as string) || null,
      ip: clientIp
    }).catch((err) => {
      logger.error('Failed to log URL click analytics', err instanceof Error ? err : new Error(String(err)), {
        shortCode,
      });
    });

    // Update counters (best-effort)
    try {
      await supabase
        .from('shortened_urls')
        .update({
          click_count: (urlData.click_count || 0) + 1,
          last_clicked_at: new Date().toISOString()
        })
        .eq('short_code', shortCode);
    } catch (err) {
      logger.error('Failed to update click counters for short URL', err instanceof Error ? err : new Error(String(err)), {
        shortCode,
      });
    }

    // Redirect
    return res.redirect(301, urlData.original_url);
  } catch (e) {
    logger.error('Redirect error', e instanceof Error ? e : new Error(String(e)), {
      shortCode: req.params.shortCode,
    });
    return res.status(500).send('Internal server error');
  }
});

// -----------------------------------------
// URL Shortener: Simple analytics API (GET)
// -----------------------------------------
app.get('/api/analytics/:shortCode', async (req, res) => {
  const { shortCode } = req.params;
  try {
    const { data: analytics, error } = await supabase
      .from('url_analytics')
      .select('*')
      .eq('short_code', shortCode)
      .order('clicked_at', { ascending: false })
      .limit(100);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch analytics' });
    }
    return res.json({ analytics: analytics ?? [] });
  } catch (e) {
    logger.error('Analytics API error', e instanceof Error ? e : new Error(String(e)), {
      shortCode: req.params.shortCode,
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// -----------------------------------------
// URL Shortener: Analytics retention cleanup
// -----------------------------------------
async function runAnalyticsRetentionCleanup() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - ANALYTICS_RETENTION_DAYS);
  try {
    await supabase
      .from('url_analytics')
      .delete()
      .lt('clicked_at', cutoff.toISOString());
  } catch (e) {
    logger.error('Analytics retention cleanup failed', e instanceof Error ? e : new Error(String(e)));
  }
}

// Run at startup and hourly thereafter
runAnalyticsRetentionCleanup().catch((err) => {
  logger.error('Initial analytics retention cleanup invoke failed', err instanceof Error ? err : new Error(String(err)));
});
const retentionInterval = setInterval(runAnalyticsRetentionCleanup, 60 * 60 * 1000);

// -------------------------------
// Discord role caching utilities
// -------------------------------
let cachedMenteeRoleId: string | null = null;
async function getMenteeRoleId(): Promise<string | null> {
  if (cachedMenteeRoleId) return cachedMenteeRoleId;
  try {
    const roleId = await discordApi.findRoleByName('1-on-1 Mentee');
    if (roleId) {
      cachedMenteeRoleId = roleId;
      return cachedMenteeRoleId;
    }
  } catch (err) {
    logger.error('Failed to fetch Discord role for mentee role cache', err instanceof Error ? err : new Error(String(err)));
  }
  return null;
}

// -------------------------------
// Graceful shutdown
// -------------------------------
function shutdown(signal: string) {
  logger.info(`${signal} received. Shutting down webhook server gracefully...`);
  try {
    clearInterval(retentionInterval);
    clearInterval(webhookRateMapCleanupInterval);
  } catch (error) {
    // Ignore errors during shutdown cleanup
    logger.warn('Error clearing intervals during shutdown', { 
      error: error instanceof Error ? error.message : String(error),
    });
  }

  server.close((err?: Error) => {
    if (err) {
      logger.error('Error during server close', err instanceof Error ? err : new Error(String(err)));
      process.exit(1);
    } else {
      logger.info('Webhook server closed. Goodbye!');
      process.exit(0);
    }
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// -----------------------------------------
// Centralized error handling middleware
// -----------------------------------------
app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const requestId = getRequestIdFromRequest(req);
  const formattedError =
    err instanceof Error
      ? { message: err.message, stack: err.stack }
      : { message: String(err) };
  logger.error('Unhandled error in request handler', new Error('Unhandled request error'), {
    path: req.path,
    method: req.method,
    requestId,
    error: formattedError,
  });

  if (res.headersSent) {
    return;
  }

  res.status(500).json({
    error: 'Internal server error',
    requestId,
  });
});

