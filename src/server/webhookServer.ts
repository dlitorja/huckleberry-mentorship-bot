// src/server/webhookServer.ts

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { supabase } from '../bot/supabaseClient.js';
import { Resend } from 'resend';
import oauthCallback from './oauthCallback.js';
import { notifyAdminPurchase, notifyAdminError } from '../utils/adminNotifications.js';
import { CONFIG, getSupportContactString } from '../config/constants.js';

const app = express();
const PORT = process.env.WEBHOOK_PORT || 3000;

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

    // Check if this is a returning/existing student
    const { data: existingMentee, error: menteeCheckError } = await supabase
      .from('mentees')
      .select('id, discord_id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    // RETURNING STUDENT FLOW
    if (existingMentee && existingMentee.discord_id) {
      console.log(`🔄 Returning student detected: ${email}`);

      // Find their mentorship with this instructor
      const { data: mentorship, error: mentorshipError } = await supabase
        .from('mentorships')
        .select('id, sessions_remaining, total_sessions')
        .eq('mentee_id', existingMentee.id)
        .eq('instructor_id', offerData.instructor_id)
        .single();

      if (mentorshipError || !mentorship) {
        // They exist but don't have a mentorship with THIS instructor (edge case)
        console.log(`Creating new mentorship for existing mentee with new instructor`);
        await supabase
          .from('mentorships')
          .insert({
            mentee_id: existingMentee.id,
            instructor_id: offerData.instructor_id,
            sessions_remaining: CONFIG.DEFAULT_SESSIONS_PER_PURCHASE,
            total_sessions: CONFIG.DEFAULT_SESSIONS_PER_PURCHASE
          });
      } else {
        // Update sessions: Add to their current balance (allows banking)
        const newSessionsRemaining = mentorship.sessions_remaining + CONFIG.DEFAULT_SESSIONS_PER_PURCHASE;
        const newTotalSessions = Math.max(mentorship.total_sessions, newSessionsRemaining);

        await supabase
          .from('mentorships')
          .update({
            sessions_remaining: newSessionsRemaining,
            total_sessions: newTotalSessions
          })
          .eq('id', mentorship.id);

        console.log(`✅ Added ${CONFIG.DEFAULT_SESSIONS_PER_PURCHASE} sessions to returning student. New balance: ${newSessionsRemaining}`);
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
                `Thank you for continuing your mentorship with **${instructorName}**!\n\n` +
                `✅ **${CONFIG.DEFAULT_SESSIONS_PER_PURCHASE} new sessions** have been added to your account.\n` +
                `💬 Reach out to your instructor to schedule your next session.\n\n` +
                `We're excited to continue working with you!\n\n` +
                `_Having any issues? ${getSupportContactString()}_`
            }),
          });
          console.log('✅ Renewal DM sent to returning student');
        }
      } catch (dmError) {
        console.log('Could not send renewal DM to student:', dmError);
      }

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
                  `<@${existingMentee.discord_id}> (${email}) has renewed their mentorship!\n\n` +
                  `✅ ${CONFIG.DEFAULT_SESSIONS_PER_PURCHASE} new sessions added to their account.\n` +
                  `📅 They're ready to schedule their next session.`
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

    // Get instructor name for personalized email
    const instructorName = (offerData as any).instructors?.name || 'your instructor';

    // Send email via Resend
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: email,
      subject: 'Welcome to Your Mentorship Program! 🎉',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #5865F2;">Welcome to ${CONFIG.ORGANIZATION_NAME}!</h1>
          
          <p style="font-size: 16px; line-height: 1.6;">
            Thank you for your purchase! We're excited to have you join our community.
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

    // Extract price from webhook payload (if available)
    const offerPrice = req.body.payment_transaction?.amount_paid_decimal || 
                       req.body.payload?.amount_paid_decimal || 
                       req.body.order?.order_items?.[0]?.unit_cost_decimal;

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

// Start server
app.listen(PORT, () => {
  console.log(`Webhook server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Kajabi webhook: http://localhost:${PORT}/webhook/kajabi`);
});

export default app;

