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
import crypto from 'crypto';

const app = express();
const PORT = process.env.WEBHOOK_PORT || 3000;
const ANALYTICS_RETENTION_DAYS = parseInt(process.env.ANALYTICS_RETENTION_DAYS || '180', 10);

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use(oauthCallback);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Webhook server is running' });
});

// -------------------------------
// Webhook helper functions
// -------------------------------
async function readdMenteeRoleIfWasEnded(discordUserId: string): Promise<boolean> {
  try {
    const roleId = await getMenteeRoleId();
    if (!roleId) return false;
    await fetch(
      `https://discord.com/api/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordUserId}/roles/${roleId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        },
      }
    );
    return true;
  } catch {
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
        const studentDmResponse = await fetch(`https://discord.com/api/users/@me/channels`, {
          method: 'POST',
          headers: {
            Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ recipient_id: studentDiscordId }),
        });
        const studentDmChannel: { id?: string } = await studentDmResponse.json();
        if (studentDmChannel.id) {
          await fetch(`https://discord.com/api/channels/${studentDmChannel.id}/messages`, {
            method: 'POST',
            headers: {
              Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              content: `🎉 **Payment Processed Successfully!**\n\n` +
                `Thank you for continuing your **1-on-1 mentorship** with **${instructorName}**!\n\n` +
                `✅ **${CONFIG.DEFAULT_SESSIONS_PER_PURCHASE} new 1-on-1 sessions** have been added to your account.\n` +
                `💬 Reach out to your instructor to schedule your next 1-on-1 session.\n\n` +
                `We're excited to continue your personalized mentorship journey!\n\n` +
                `_Having any issues? ${getSupportContactString()}_`
            }),
          });
        }
      } catch {}
    })(),
    (async () => {
      if (instructorDiscordData?.discord_id) {
        try {
          const instructorDmResponse = await fetch(`https://discord.com/api/users/@me/channels`, {
            method: 'POST',
            headers: {
              Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ recipient_id: instructorDiscordData.discord_id }),
          });
          const instructorDmChannel: { id?: string } = await instructorDmResponse.json();
          if (instructorDmChannel.id) {
            await fetch(`https://discord.com/api/channels/${instructorDmChannel.id}/messages`, {
              method: 'POST',
              headers: {
                Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                content: `🔄 **Returning Student Renewed**\n\n` +
                  `<@${studentDiscordId}> (${email}) has renewed their **1-on-1 mentorship**!\n\n` +
                  `✅ **${CONFIG.DEFAULT_SESSIONS_PER_PURCHASE} new 1-on-1 sessions** added to their account.\n` +
                  `📊 **Total Sessions:** ${sessionTotal}\n` +
                  `🛒 **Purchased:** ${purchaseTime}\n\n` +
                  `They're ready to schedule their next 1-on-1 session!`
              }),
            });
          }
        } catch {}
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
}): Promise<{ emailId?: string }> {
  const { email, instructorName, inviteLink, offerName, offerPrice } = params;

  const { data: emailData, error: emailError } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: email,
    subject: 'Welcome to Your 1-on-1 Mentorship Program! 🎉',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #5865F2;">Welcome to Your 1-on-1 Mentorship!</h1>
        <p style="font-size: 16px; line-height: 1.6;">
          Thank you for purchasing your 1-on-1 mentorship! We're excited to have you join our community.
        </p>
        <div style="background-color: #f0f7ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #5865F2;">
          <p style="margin: 0; font-size: 16px;">
            <strong>👨‍🏫 Your Instructor:</strong> ${instructorName}
          </p>
        </div>
        <h2 style="color: #333; font-size: 20px;">Next Step: Join Our Discord Server</h2>
        <p style="font-size: 15px; line-height: 1.6;">
          Click the button below to join our Discord community and connect with your instructor:
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
            You still need to click the link above! This will link your account to your purchase and automatically assign you the "1-on-1 Mentee" role.
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
}): Promise<{ message: string }> {
  const { email, instructorId, instructorName, existingMentee } = params;

  const { data: mentorship, error: mentorshipError } = await supabase
    .from('mentorships')
    .select('id, sessions_remaining, total_sessions, status, returned_after_end')
    .eq('mentee_id', existingMentee.id)
    .eq('instructor_id', instructorId)
    .maybeSingle();

  if (mentorshipError || !mentorship) {
    await supabase
      .from('mentorships')
      .insert({
        mentee_id: existingMentee.id,
        instructor_id: instructorId,
        sessions_remaining: CONFIG.DEFAULT_SESSIONS_PER_PURCHASE,
        total_sessions: CONFIG.DEFAULT_SESSIONS_PER_PURCHASE,
        status: 'active'
      });
  } else {
    const newSessionsRemaining = mentorship.sessions_remaining + CONFIG.DEFAULT_SESSIONS_PER_PURCHASE;
    const newTotalSessions = Math.max(mentorship.total_sessions, newSessionsRemaining);
    const wasEnded = mentorship.status === 'ended';

    await supabase
      .from('mentorships')
      .update({
        sessions_remaining: newSessionsRemaining,
        total_sessions: newTotalSessions,
        status: 'active',
        ended_at: null,
        end_reason: null,
        returned_after_end: wasEnded ? true : mentorship.returned_after_end
      })
      .eq('id', mentorship.id);

    if (wasEnded) {
      await readdMenteeRoleIfWasEnded(existingMentee.discord_id).catch(() => {});
    }
  }

  const { data: updatedMentorship } = await supabase
    .from('mentorships')
    .select('sessions_remaining, total_sessions')
    .eq('mentee_id', existingMentee.id)
    .eq('instructor_id', instructorId)
    .single();

  const sessionTotal = updatedMentorship
    ? `${updatedMentorship.sessions_remaining}/${updatedMentorship.total_sessions}`
    : 'N/A';

  const purchaseTime = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

  await notifyReturningStudentAndInstructor({
    studentDiscordId: existingMentee.discord_id,
    email,
    instructorName,
    instructorId,
    sessionTotal,
    purchaseTime,
  }).catch(() => {});

  return { message: 'Returning student - sessions added' };
}

async function handleNewStudentPurchase(params: {
  email: string;
  instructorId: string;
  instructorName: string;
  offerIdString: string;
  offerName: string;
  offerPrice?: string | number | null;
}): Promise<{ emailId?: string }> {
  const { email, instructorId, instructorName, offerIdString, offerName, offerPrice } = params;

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

  const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.DISCORD_REDIRECT_URI!)}&response_type=code&scope=identify%20email%20guilds.join&state=${encodeURIComponent(oauthState)}`;

  const { emailId } = await sendInviteEmailAndNotifyAdmin({
    email,
    instructorName,
    inviteLink,
    offerName,
    offerPrice,
  });

  return { emailId };
}

// Kajabi webhook endpoint
app.post('/webhook/kajabi', async (req, res) => {
  try {
    console.log('Received Kajabi webhook:', JSON.stringify(req.body, null, 2));

    // Extract data from Kajabi's nested structure
    // Supports both general webhooks (member.email, offer.id) and offer-specific webhooks (payload.member_email, payload.offer_id)
    const email = req.body.member?.email || req.body.payload?.member_email || req.body.email;
    const offer_id = req.body.offer?.id || req.body.payload?.offer_id || req.body.offer_id;

    if (!email || !offer_id || offer_id === 0) {
      console.error('Missing email or offer_id. Email:', email, 'Offer ID:', offer_id);
      return res.status(400).json({ error: 'Missing required fields: email, offer_id' });
    }
    
    // Convert offer_id to string for consistency
    const offerIdString = String(offer_id);

    // Lookup the instructor for this offer
    const { data: offerData, error: offerError } = await supabase
      .from('kajabi_offers')
      .select('instructor_id, offer_name, instructors(name)')
      .eq('offer_id', offerIdString)
      .single();

    if (offerError || !offerData) {
      console.error('Offer not found:', offerIdString, offerError);
      
      // Notify admin of unmapped offer
      await notifyAdminError({
        type: 'webhook_error',
        message: `Unmapped Kajabi offer received: ${offerIdString}`,
        details: `Email: ${email}\nThis offer needs to be added to the database.`,
        studentEmail: email
      });
      
      return res.status(404).json({ error: 'Offer not found in database' });
    }

    // Get instructor name for personalized messages
    const instructorName = (offerData as { instructors?: { name?: string } } | null)?.instructors?.name || 'your instructor';

    // Extract price from webhook payload (if available)
    const offerPrice = req.body.payment_transaction?.amount_paid_decimal || 
                       req.body.payload?.amount_paid_decimal || 
                       req.body.order?.order_items?.[0]?.unit_cost_decimal;

    // Check if this is a returning/existing student
    const { data: existingMentee } = await supabase
      .from('mentees')
      .select('id, discord_id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    // RETURNING STUDENT FLOW
    if (existingMentee && existingMentee.discord_id) {
      const result = await handleReturningStudentRenewal({
        email,
        instructorId: offerData.instructor_id,
        instructorName,
        existingMentee: { id: existingMentee.id, discord_id: existingMentee.discord_id },
      });

      return res.json({
        success: true,
        message: result.message,
        returning_student: true,
      });
    }

    // NEW STUDENT FLOW
    try {
      const { emailId } = await handleNewStudentPurchase({
        email,
        instructorId: offerData.instructor_id,
        instructorName,
        offerIdString,
        offerName: ((offerData as { offer_name?: string } | null)?.offer_name) || 'Unknown Offer',
        offerPrice,
      });

      return res.json({
        success: true,
        message: 'Webhook processed successfully',
        email_id: emailId,
      });
    } catch (insertOrEmailError) {
      console.error('Failed in new student flow:', insertOrEmailError);
      await notifyAdminError({
        type: 'database_error',
        message: 'Failed to process pending join or send email',
        details: insertOrEmailError,
        studentEmail: email,
      });
      return res.status(500).json({ error: 'Failed to process new student flow' });
    }

  } catch (error) {
    console.error('Webhook error:', error);
    
    // Notify admin of unexpected error
    await notifyAdminError({
      type: 'webhook_error',
      message: 'Unexpected error processing Kajabi webhook',
      details: error
    });
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Kajabi cancellation/refund webhook endpoint
app.post('/webhook/kajabi/cancellation', async (req, res) => {
  try {
    console.log('Received Kajabi cancellation webhook:', JSON.stringify(req.body, null, 2));

    // Extract email from various possible Kajabi webhook formats
    const email = req.body.member?.email || 
                  req.body.payload?.member_email || 
                  req.body.email ||
                  req.body.subscription?.member?.email;
    
    // Extract event type
    const eventType = req.body.event_type || req.body.type || 'unknown';

    if (!email) {
      console.error('Missing email in cancellation webhook');
      return res.status(400).json({ error: 'Missing required field: email' });
    }

    console.log(`Processing cancellation for: ${email}, Event: ${eventType}`);

    // Find student by email
    const { data: menteeData, error: menteeError } = await supabase
      .from('mentees')
      .select('id, discord_id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (menteeError || !menteeData || !menteeData.discord_id) {
      console.log(`No active mentee found for ${email} - they may not have joined Discord yet`);
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

    // Remove student role
    const result = await removeStudentRole({
      menteeDiscordId: menteeData.discord_id,
      reason,
      sendGoodbyeDm: true,
      notifyAdmin: true,
      client: undefined // Use API method since we don't have client in webhook context
    });

    if (result.success) {
      console.log(`✅ Successfully processed cancellation for ${email}`);
      return res.json({ 
        success: true, 
        message: 'Student role removed successfully'
      });
    } else {
      console.error(`Failed to remove role for ${email}:`, result.message);
      return res.status(500).json({ 
        error: 'Failed to remove student role',
        details: result.message
      });
    }

  } catch (error) {
    console.error('Cancellation webhook error:', error);
    
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
  console.log(`Webhook server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Kajabi webhook: http://localhost:${PORT}/webhook/kajabi`);
  console.log(`Kajabi cancellation webhook: http://localhost:${PORT}/webhook/kajabi/cancellation`);
});

export default app;

// -------------------------------
// URL Shortener: Redirect handler
// -------------------------------
// Simple in-memory IP rate limiter for redirect endpoint
type RateEntry = { count: number; resetAt: number };
const redirectRateMap: Map<string, RateEntry> = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = parseInt(process.env.REDIRECT_RATE_LIMIT_MAX || '200', 10); // per IP per window

function checkRateLimit(ip: string | null): boolean {
  if (!ip) return true;
  const now = Date.now();
  const entry = redirectRateMap.get(ip);
  if (!entry || entry.resetAt <= now) {
    redirectRateMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count < RATE_LIMIT_MAX) {
    entry.count += 1;
    return true;
  }
  return false;
}

app.get('/:shortCode', async (req, res) => {
  const { shortCode } = req.params;

  try {
    const clientIp =
      (req.headers['x-forwarded-for'] as string) ||
      (req.socket?.remoteAddress ?? null);

    if (!checkRateLimit(clientIp)) {
      return res.status(429).send('Too Many Requests');
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
      ip: (req.headers['x-forwarded-for'] as string) || (req.socket?.remoteAddress ?? null)
    }).catch((err) => {
      console.error('Failed to log URL click analytics:', {
        shortCode,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    // Update counters (best-effort)
    supabase
      .from('shortened_urls')
      .update({
        click_count: (urlData.click_count || 0) + 1,
        last_clicked_at: new Date().toISOString()
      })
      .eq('short_code', shortCode)
      .catch((err) => {
        console.error('Failed to update click counters for short URL:', {
          shortCode,
          error: err instanceof Error ? err.message : String(err),
        });
      });

    // Redirect
    return res.redirect(301, urlData.original_url);
  } catch (e) {
    console.error('Redirect error:', e);
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
    console.error('Analytics API error:', e);
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
    console.error('Analytics retention cleanup failed:', e);
  }
}

// Run at startup and hourly thereafter
runAnalyticsRetentionCleanup().catch((err) => {
  console.error('Initial analytics retention cleanup invoke failed:', err);
});
const retentionInterval = setInterval(runAnalyticsRetentionCleanup, 60 * 60 * 1000);

// -------------------------------
// Discord role caching utilities
// -------------------------------
let cachedMenteeRoleId: string | null = null;
async function getMenteeRoleId(): Promise<string | null> {
  if (cachedMenteeRoleId) return cachedMenteeRoleId;
  try {
    const rolesResponse = await fetch(
      `https://discord.com/api/guilds/${process.env.DISCORD_GUILD_ID}/roles`,
      {
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        },
      }
    );
    const roles: Array<{ id?: string; name?: string }> = await rolesResponse.json();
    const menteeRole = roles.find(r => r && r.name === '1-on-1 Mentee');
    if (menteeRole?.id) {
      cachedMenteeRoleId = menteeRole.id;
      return cachedMenteeRoleId;
    }
  } catch (err) {
    console.error('Failed to fetch Discord roles for mentee role cache:', err);
  }
  return null;
}

// -------------------------------
// Graceful shutdown
// -------------------------------
function shutdown(signal: string) {
  console.log(`${signal} received. Shutting down webhook server gracefully...`);
  try {
    clearInterval(retentionInterval);
  } catch {}

  server.close((err?: Error) => {
    if (err) {
      console.error('Error during server close:', err);
      process.exit(1);
    } else {
      console.log('Webhook server closed. Goodbye!');
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
  const requestId = (req.headers['x-request-id'] as string) || undefined;
  const formattedError =
    err instanceof Error
      ? { message: err.message, stack: err.stack }
      : { message: String(err) };
  console.error('Unhandled error in request handler:', {
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

