// src/server/webhookServer.ts

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { supabase } from '../bot/supabaseClient.js';
import { Resend } from 'resend';
import oauthCallback from './oauthCallback.js';

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
      .select('instructor_id')
      .eq('offer_id', offerIdString)
      .single();

    if (offerError || !offerData) {
      console.error('Offer not found:', offerIdString, offerError);
      return res.status(404).json({ error: 'Offer not found in database' });
    }

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
      return res.status(500).json({ error: 'Failed to store pending join' });
    }

    // Generate Discord OAuth invite link
    const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.DISCORD_REDIRECT_URI!)}&response_type=code&scope=identify%20email%20guilds.join`;

    // Send email via Resend
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: email,
      subject: 'Welcome! Join Our Discord Community',
      html: `
        <h1>Welcome to the Mentorship Program!</h1>
        <p>Thank you for your purchase. We're excited to have you join our community!</p>
        <p>Click the button below to join our Discord server and get started:</p>
        <a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background-color: #5865F2; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">
          Join Discord Server
        </a>
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p>${inviteLink}</p>
        <p>See you in Discord!</p>
      `
    });

    if (emailError) {
      console.error('Failed to send email:', emailError);
      return res.status(500).json({ error: 'Failed to send email' });
    }

    console.log('Email sent successfully:', emailData);

    res.json({ 
      success: true, 
      message: 'Webhook processed successfully',
      email_id: emailData?.id
    });

  } catch (error) {
    console.error('Webhook error:', error);
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

