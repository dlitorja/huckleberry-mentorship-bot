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
    const instructorName = (offerData as any).instructors?.name || 'your instructor';

    // Extract price from webhook payload (if available)
    const offerPrice = req.body.payment_transaction?.amount_paid_decimal || 
                       req.body.payload?.amount_paid_decimal || 
                       req.body.order?.order_items?.[0]?.unit_cost_decimal;

    // Check if this is a returning/existing student
    const { data: existingMentee, error: menteeCheckError } = await supabase
      .from('mentees')
      .select('id, discord_id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    // RETURNING STUDENT FLOW
    if (existingMentee && existingMentee.discord_id) {
      console.log(`🔄 Returning student detected: ${email}`);

      // Find their mentorship with this instructor (check both active and ended)
      const { data: mentorship, error: mentorshipError } = await supabase
        .from('mentorships')
        .select('id, sessions_remaining, total_sessions, status, returned_after_end')
        .eq('mentee_id', existingMentee.id)
        .eq('instructor_id', offerData.instructor_id)
        .maybeSingle();

      if (mentorshipError || !mentorship) {
        // They exist but don't have a mentorship with THIS instructor (edge case)
        console.log(`Creating new mentorship for existing mentee with new instructor`);
        await supabase
          .from('mentorships')
          .insert({
            mentee_id: existingMentee.id,
            instructor_id: offerData.instructor_id,
            sessions_remaining: CONFIG.DEFAULT_SESSIONS_PER_PURCHASE,
            total_sessions: CONFIG.DEFAULT_SESSIONS_PER_PURCHASE,
            status: 'active'
          });
      } else {
        // Update sessions: Add to their current balance (allows banking)
        const newSessionsRemaining = mentorship.sessions_remaining + CONFIG.DEFAULT_SESSIONS_PER_PURCHASE;
        const newTotalSessions = Math.max(mentorship.total_sessions, newSessionsRemaining);
        const wasEnded = mentorship.status === 'ended';

        await supabase
          .from('mentorships')
          .update({
            sessions_remaining: newSessionsRemaining,
            total_sessions: newTotalSessions,
            status: 'active',  // Reactivate if it was ended
            ended_at: null,    // Clear ended timestamp
            end_reason: null,  // Clear end reason
            returned_after_end: wasEnded ? true : mentorship.returned_after_end  // Track if they returned
          })
          .eq('id', mentorship.id);

        console.log(`✅ Added ${CONFIG.DEFAULT_SESSIONS_PER_PURCHASE} sessions to returning student. New balance: ${newSessionsRemaining}`);

        // If mentorship was ended, re-add the Discord role
        if (wasEnded) {
          console.log('🔄 Reactivating ended mentorship - re-adding Discord role');
          try {
            // Get guild roles to find the "1-on-1 Mentee" role ID
            const rolesResponse = await fetch(
              `https://discord.com/api/guilds/${process.env.DISCORD_GUILD_ID}/roles`,
              {
                headers: {
                  Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
                },
              }
            );

            const roles: any[] = await rolesResponse.json();
            const menteeRole = roles.find(role => role.name === '1-on-1 Mentee');

            if (menteeRole) {
              // Add the role back
              await fetch(
                `https://discord.com/api/guilds/${process.env.DISCORD_GUILD_ID}/members/${existingMentee.discord_id}/roles/${menteeRole.id}`,
                {
                  method: 'PUT',
                  headers: {
                    Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
                  },
                }
              );
              console.log('✅ Re-added 1-on-1 Mentee role to returning student');
            }
          } catch (roleError) {
            console.log('Could not re-add role to returning student:', roleError);
          }
        }
      }

      // Send renewal notification to student via Discord DM
      try {
        const studentDmResponse = await fetch(`https://discord.com/api/users/@me/channels`, {
          method: 'POST',
          headers: {
            Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipient_id: existingMentee.discord_id,
          }),
        });
        
        const studentDmChannel: any = await studentDmResponse.json();
        
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
          console.log('✅ Renewal DM sent to returning student');
        }
      } catch (dmError) {
        console.log('Could not send renewal DM to student:', dmError);
      }

      // Get updated mentorship data to show new session total
      const { data: updatedMentorship } = await supabase
        .from('mentorships')
        .select('sessions_remaining, total_sessions')
        .eq('mentee_id', existingMentee.id)
        .eq('instructor_id', offerData.instructor_id)
        .single();

      const sessionTotal = updatedMentorship 
        ? `${updatedMentorship.sessions_remaining}/${updatedMentorship.total_sessions}` 
        : 'N/A';

      const purchaseTime = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

      // Send notification to instructor via Discord DM
      const { data: instructorDiscordData } = await supabase
        .from('instructors')
        .select('discord_id')
        .eq('id', offerData.instructor_id)
        .single();

      if (instructorDiscordData?.discord_id) {
        try {
          const instructorDmResponse = await fetch(`https://discord.com/api/users/@me/channels`, {
            method: 'POST',
            headers: {
              Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              recipient_id: instructorDiscordData.discord_id,
            }),
          });
          
          const instructorDmChannel: any = await instructorDmResponse.json();
          
          if (instructorDmChannel.id) {
            await fetch(`https://discord.com/api/channels/${instructorDmChannel.id}/messages`, {
              method: 'POST',
              headers: {
                Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                content: `🔄 **Returning Student Renewed**\n\n` +
                  `<@${existingMentee.discord_id}> (${email}) has renewed their **1-on-1 mentorship**!\n\n` +
                  `✅ **${CONFIG.DEFAULT_SESSIONS_PER_PURCHASE} new 1-on-1 sessions** added to their account.\n` +
                  `📊 **Total Sessions:** ${sessionTotal}\n` +
                  `🛒 **Purchased:** ${purchaseTime}\n\n` +
                  `They're ready to schedule their next 1-on-1 session!`
              }),
            });
            console.log('✅ Renewal notification sent to instructor');
          }
        } catch (instructorDmError) {
          console.log('Could not send renewal notification to instructor:', instructorDmError);
        }
      }

      // Send renewal notification to admin via email
      try {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL!,
          to: CONFIG.ADMIN_EMAIL,
          subject: `🔄 Renewal: ${email}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #4CAF50;">🔄 STUDENT RENEWAL</h2>
              
              <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>👤 Student:</strong> ${email}</p>
                <p><strong>👨‍🏫 Instructor:</strong> ${instructorName}</p>
                <p><strong>📦 Offer:</strong> ${(offerData as any).offer_name}</p>
                ${offerPrice ? `<p><strong>💰 Price:</strong> $${offerPrice}</p>` : ''}
                <p><strong>⏰ Time:</strong> ${new Date().toLocaleString()}</p>
              </div>
              
              <div style="background-color: #e8f5e9; padding: 15px; border-left: 4px solid #4CAF50; border-radius: 4px;">
                <p style="margin: 0;"><strong>✅ Returning Student</strong></p>
                <p style="margin: 10px 0 0 0;">This student already has the 1-on-1 Mentee role.</p>
                <p style="margin: 10px 0 0 0;">✅ ${CONFIG.DEFAULT_SESSIONS_PER_PURCHASE} new sessions have been added to their account.</p>
                <p style="margin: 10px 0 0 0;">💬 Student and instructor have been notified.</p>
              </div>
            </div>
          `
        });
        console.log('✅ Admin renewal notification email sent');
      } catch (emailError) {
        console.error('Failed to send admin renewal email:', emailError);
      }

      return res.json({ 
        success: true, 
        message: 'Returning student - sessions added',
        returning_student: true
      });
    }

    // NEW STUDENT FLOW (original code continues here)
    // Store pending join
    const { error: insertError } = await supabase
      .from('pending_joins')
      .insert({
        email: email.toLowerCase(),
        instructor_id: offerData.instructor_id,
        offer_id: offerIdString,
        created_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('Failed to store pending join:', insertError);
      
      // Notify admin of database error
      await notifyAdminError({
        type: 'database_error',
        message: 'Failed to store pending join in database',
        details: insertError,
        studentEmail: email
      });
      
      return res.status(500).json({ error: 'Failed to store pending join' });
    }

    // Generate Discord OAuth invite link
    const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.DISCORD_REDIRECT_URI!)}&response_type=code&scope=identify%20email%20guilds.join`;

    // Send email via Resend
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
      console.error('Failed to send email:', emailError);
      
      // Notify admin of email failure
      await notifyAdminError({
        type: 'email_failed',
        message: 'Failed to send invite email via Resend',
        details: emailError,
        studentEmail: email
      });
      
      return res.status(500).json({ error: 'Failed to send email' });
    }

    console.log('Email sent successfully:', emailData);

    // Notify admin of successful purchase
    await notifyAdminPurchase({
      studentEmail: email,
      instructorName: (offerData as any).instructors?.name || 'Unknown',
      offerName: (offerData as any).offer_name || 'Unknown Offer',
      offerPrice: offerPrice ? String(offerPrice) : undefined
    });

    res.json({ 
      success: true, 
      message: 'Webhook processed successfully',
      email_id: emailData?.id
    });

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
app.listen(PORT, () => {
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
    }).catch(() => {});

    // Update counters (best-effort)
    supabase
      .from('shortened_urls')
      .update({
        click_count: (urlData.click_count || 0) + 1,
        last_clicked_at: new Date().toISOString()
      })
      .eq('short_code', shortCode)
      .then(() => {})
      .catch(() => {});

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
runAnalyticsRetentionCleanup().catch(() => {});
setInterval(runAnalyticsRetentionCleanup, 60 * 60 * 1000);

