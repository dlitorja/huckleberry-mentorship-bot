// src/server/oauthCallback.ts

import 'dotenv/config';
import express from 'express';
import { supabase } from '../bot/supabaseClient.js';
import { notifyAdminError } from '../utils/adminNotifications.js';
import { CONFIG, getSupportContactString } from '../config/constants.js';

const router = express.Router();

// OAuth callback endpoint
router.get('/oauth/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    return res.status(400).send('Missing authorization code');
  }
  if (!state || typeof state !== 'string') {
    return res.status(400).send('Missing OAuth state');
  }

  try {
    // Validate state BEFORE token exchange
    const { data: pendingJoinByState, error: stateError } = await supabase
      .from('pending_joins')
      .select('*')
      .eq('oauth_state', state)
      .is('discord_user_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (stateError || !pendingJoinByState) {
      return res.status(400).send('Invalid or expired OAuth state');
    }

    if (pendingJoinByState.oauth_state_expires_at && new Date(pendingJoinByState.oauth_state_expires_at) < new Date()) {
      return res.status(400).send('OAuth state expired');
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: process.env.DISCORD_REDIRECT_URI!,
      }),
    });

    const tokenData: { access_token?: string } = await tokenResponse.json();

    if (!tokenData.access_token) {
      console.error('Failed to get access token:', tokenData);
      return res.status(500).send('Failed to authenticate with Discord');
    }

    // Get user info
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userData: { id: string; email: string } = await userResponse.json();
    console.log('User authenticated:', userData.email, userData.id);

    // Use the state-validated pending join
    const pendingJoin = pendingJoinByState;

    if (!pendingJoin) {
      console.error('No pending join found for state:', state);
      return res.send(`
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>❌ No Purchase Found</h1>
            <p>We couldn't find a purchase associated with your session.</p>
            <p>Please contact support at ${CONFIG.SUPPORT_EMAIL} if you believe this is an error.</p>
          </body>
        </html>
      `);
    }

    // Find the "1-on-1 Mentee" role ID from your guild
    const rolesResponse = await fetch(`https://discord.com/api/guilds/${process.env.DISCORD_GUILD_ID}/roles`, {
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      },
    });
    const roles: Array<{ id: string; name: string }> = await rolesResponse.json();
    const menteeRole = roles.find((r) => r.name === '1-on-1 Mentee');

    if (!menteeRole) {
      console.error('Could not find "1-on-1 Mentee" role in guild');
    }

    // Add user to guild (if not already a member)
    const addMemberResponse = await fetch(`https://discord.com/api/guilds/${process.env.DISCORD_GUILD_ID}/members/${userData.id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access_token: tokenData.access_token,
        roles: menteeRole ? [menteeRole.id] : []
      }),
    });

    const addMemberResult = await addMemberResponse.text();
    console.log('Add member result:', addMemberResponse.status, addMemberResult);

    // Assign role (works for both new and existing members)
    if (menteeRole) {
      const assignRoleResponse = await fetch(`https://discord.com/api/guilds/${process.env.DISCORD_GUILD_ID}/members/${userData.id}/roles/${menteeRole.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        },
      });
      console.log('Assign role result:', assignRoleResponse.status);
      
      if (!assignRoleResponse.ok) {
        const errorText = await assignRoleResponse.text();
        console.error('Failed to assign role:', errorText);
        
        // Notify admin of role assignment failure
        await notifyAdminError({
          type: 'role_assignment_failed',
          message: 'Failed to assign "1-on-1 Mentee" role',
          details: errorText,
          studentEmail: userData.email
        });
      } else {
        console.log(`✅ Successfully assigned "1-on-1 Mentee" role to ${userData.email}`);
      }
    }

    // Update pending join with Discord user ID
    await supabase
      .from('pending_joins')
      .update({
        discord_user_id: userData.id,
        joined_at: new Date().toISOString(),
        oauth_state: null,
        oauth_state_expires_at: null
      })
      .eq('id', pendingJoin.id);

    // Get instructor Discord ID and offer details
    const { data: instructorData, error: _instructorError } = await supabase
      .from('instructors')
      .select('discord_id, name')
      .eq('id', pendingJoin.instructor_id)
      .single();

    // Get offer details
    const { data: offerDetails } = await supabase
      .from('kajabi_offers')
      .select('offer_name')
      .eq('offer_id', pendingJoin.offer_id)
      .single();

    // Ensure mentee exists and mentorship is created with default sessions
    // 1) Upsert mentee by email, attach discord_id
    const { data: existingMenteeByEmail } = await supabase
      .from('mentees')
      .select('id, discord_id')
      .eq('email', (pendingJoin.email as string).toLowerCase())
      .maybeSingle();

    let menteeId: string | null = null;
    if (existingMenteeByEmail?.id) {
      menteeId = existingMenteeByEmail.id;
      if (existingMenteeByEmail.discord_id !== userData.id) {
        await supabase
          .from('mentees')
          .update({ discord_id: userData.id })
          .eq('id', menteeId);
      }
    } else {
      const { data: newMentee } = await supabase
        .from('mentees')
        .insert({
          email: (pendingJoin.email as string).toLowerCase(),
          discord_id: userData.id
        })
        .select('id')
        .single();
      menteeId = newMentee?.id ?? null;
    }

    // 2) Ensure mentorship exists; if not, create with default sessions
    let sessionInfo = 'Sessions not yet configured';
    if (menteeId) {
      const { data: existingMentorship } = await supabase
        .from('mentorships')
        .select('id, sessions_remaining, total_sessions, status')
        .eq('mentee_id', menteeId)
        .eq('instructor_id', pendingJoin.instructor_id)
        .maybeSingle();

      if (!existingMentorship) {
        const defaultSessions = CONFIG.DEFAULT_SESSIONS_PER_PURCHASE;
        const { data: created } = await supabase
          .from('mentorships')
          .insert({
            mentee_id: menteeId,
            instructor_id: pendingJoin.instructor_id,
            sessions_remaining: defaultSessions,
            total_sessions: defaultSessions,
            status: 'active'
          })
          .select('sessions_remaining, total_sessions')
          .single();
        if (created) {
          sessionInfo = `${created.sessions_remaining}/${created.total_sessions} sessions`;
        }
      } else {
        sessionInfo = `${existingMentorship.sessions_remaining}/${existingMentorship.total_sessions} sessions`;
      }
    }

    // Format purchase date in friendly format
    const purchaseDate = new Date(pendingJoin.created_at);
    const joinDate = new Date();
    const timeToJoin = Math.floor((joinDate.getTime() - purchaseDate.getTime()) / (1000 * 60));
    const friendlyTimeToJoin = timeToJoin < 60 
      ? `${timeToJoin} minutes` 
      : `${Math.floor(timeToJoin / 60)} hours ${timeToJoin % 60} minutes`;

    // Notify admin of successful join
    try {
      const adminDmResponse = await fetch(`https://discord.com/api/users/@me/channels`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient_id: process.env.DISCORD_ADMIN_ID,
        }),
      });
      
      const adminDmChannel: { id?: string } = await adminDmResponse.json();
      
      if (adminDmChannel.id) {
        const instructorMention = instructorData?.discord_id ? `<@${instructorData.discord_id}>` : 'Unknown';
        await fetch(`https://discord.com/api/channels/${adminDmChannel.id}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: `✅ **STUDENT JOINED SUCCESSFULLY**\n\n` +
              `👤 **Student:** <@${userData.id}> (${userData.email})\n` +
              `👨‍🏫 **Instructor:** ${instructorMention}\n` +
              `📦 **Offer:** ${offerDetails?.offer_name || 'Unknown'}\n` +
              `📊 **Sessions:** ${sessionInfo}\n` +
              `🛒 **Purchased:** ${purchaseDate.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}\n` +
              `✅ **Joined:** ${joinDate.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}\n` +
              `⏱️ **Time to Join:** ${friendlyTimeToJoin}`
          }),
        });
        console.log('✅ Admin notification sent for successful join');
      }
    } catch (adminNotifyError) {
      console.log('Could not send admin notification:', adminNotifyError);
    }

    // Send welcome DM to mentee
    try {
      const menteeDmResponse = await fetch(`https://discord.com/api/users/@me/channels`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient_id: userData.id,
        }),
      });
      
      const menteeDmChannel: { id?: string } = await menteeDmResponse.json();
      
      if (menteeDmChannel.id) {
        const instructorMention = instructorData?.discord_id ? `<@${instructorData.discord_id}>` : 'your instructor';
        await fetch(`https://discord.com/api/channels/${menteeDmChannel.id}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: `Welcome to the ${CONFIG.ORGANIZATION_NAME} Community! 🎉\n\n` +
              `You've been assigned the "1-on-1 Mentee" role -- this is needed so you can access the mentorship voice channels!\n\n` +
              `Your instructor is ${instructorMention}\n\n` +
              `Please inform them of your schedule so they can check their availability -- please include your time zone, as all our instructors and students are all over the world!\n\n` +
              `Having any issues? ${getSupportContactString()}`
          }),
        });
        console.log('✅ Welcome DM sent to mentee');
      }
    } catch (dmError) {
      console.log('Could not send DM to mentee:', dmError);
    }

    // Send notification DM to instructor
    if (instructorData?.discord_id) {
      try {
        const instructorDmResponse = await fetch(`https://discord.com/api/users/@me/channels`, {
          method: 'POST',
          headers: {
            Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipient_id: instructorData.discord_id,
          }),
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
              content: `🎓 **New Mentee Alert!**\n\n` +
                `👤 **Student:** <@${userData.id}> (${userData.email})\n` +
                `📦 **Offer:** ${offerDetails?.offer_name || 'Unknown'}\n` +
                `📊 **Sessions:** ${sessionInfo}\n` +
                `🛒 **Purchased:** ${purchaseDate.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}\n` +
                `✅ **Joined:** ${joinDate.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}\n\n` +
                `Welcome your new student and help them schedule their first session!`
            }),
          });
          console.log('✅ Notification DM sent to instructor');
        }
      } catch (instructorDmError) {
        console.log('Could not send DM to instructor:', instructorDmError);
      }
    }

    // Success page
    res.send(`
      <html>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>✅ Welcome to the Community!</h1>
          <p>You've successfully joined our Discord server.</p>
          <p>Your "1-on-1 Mentee" role has been assigned!</p>
          <p>You can close this window and return to Discord.</p>
          <script>
            setTimeout(() => {
              window.close();
            }, 3000);
          </script>
        </body>
      </html>
    `);

  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send('An error occurred during authentication');
  }
});

export default router;

