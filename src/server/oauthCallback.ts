// src/server/oauthCallback.ts

import 'dotenv/config';
import express from 'express';
import { supabase } from '../bot/supabaseClient.js';
import { CONFIG, getSupportContactString } from '../config/constants.js';
import { notifyAdminError } from '../utils/adminNotifications.js';
import { discordApi } from '../utils/discordApi.js';
import { logger } from '../utils/logger.js';

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
    const tokenData = await discordApi.exchangeCodeForToken(
      code as string,
      process.env.DISCORD_REDIRECT_URI!
    );

    if (!tokenData || !tokenData.access_token) {
      logger.error('Failed to get access token from Discord OAuth', undefined, { code: code as string });
      return res.status(500).send('Failed to authenticate with Discord');
    }

    // Get user info
    const userData = await discordApi.getCurrentUser(tokenData.access_token);
    
    if (!userData || !userData.id || !userData.email) {
      logger.error('Failed to get user data from Discord', undefined, { hasToken: !!tokenData.access_token });
      return res.status(500).send('Failed to get user information from Discord');
    }
    // Discord username format: username (without @) - we'll store it with @ prefix for clarity
    const discordUsername = userData.username ? `@${userData.username}` : null;
    logger.info('User authenticated via OAuth', { 
      email: userData.email, 
      discordId: userData.id, 
      username: discordUsername 
    });

    // Use the state-validated pending join
    const pendingJoin = pendingJoinByState;

    if (!pendingJoin) {
      logger.error('No pending join found for OAuth state', undefined, { state });
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

    // Determine role name based on offer mapping (fallback to "1-on-1 Mentee")
    const { data: offerRoleData } = await supabase
      .from('kajabi_offers')
      .select('discord_role_name')
      .eq('offer_id', pendingJoin.offer_id)
      .single();
    const desiredRoleName = (offerRoleData as { discord_role_name?: string } | null)?.discord_role_name || '1-on-1 Mentee';

    // Find the desired role ID from your guild
    const menteeRoleId = await discordApi.findRoleByName(desiredRoleName);

    if (!menteeRoleId) {
      logger.error('Could not find role in guild', undefined, { roleName: desiredRoleName });
    }

    // Add user to guild (if not already a member)
    const memberAdded = await discordApi.addGuildMember(userData.id, tokenData.access_token);
    
    if (!memberAdded) {
      logger.warn('Failed to add member to guild (may already be a member)', { 
        userId: userData.id,
        email: userData.email 
      });
    }

    // Assign role (works for both new and existing members)
    if (menteeRoleId) {
      const roleAssigned = await discordApi.addRoleToMember(userData.id, menteeRoleId);
      
      if (!roleAssigned) {
        logger.error('Failed to assign role to member', undefined, {
          userId: userData.id,
          roleId: menteeRoleId,
          roleName: desiredRoleName,
          email: userData.email,
        });
        
        // Notify admin of role assignment failure
        await notifyAdminError({
          type: 'role_assignment_failed',
          message: `Failed to assign "${desiredRoleName}" role`,
          details: 'Discord API call failed',
          studentEmail: userData.email
        });
      } else {
        logger.info('Successfully assigned role to member', {
          userId: userData.id,
          roleName: desiredRoleName,
          email: userData.email,
        });
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
      // Update discord_id and discord_username if they've changed
      const updateData: { discord_id: string; discord_username?: string | null } = { discord_id: userData.id };
      if (discordUsername) {
        updateData.discord_username = discordUsername;
      }
      await supabase
        .from('mentees')
        .update(updateData)
        .eq('id', menteeId);
    } else {
      const { data: newMentee } = await supabase
        .from('mentees')
        .insert({
          email: (pendingJoin.email as string).toLowerCase(),
          discord_id: userData.id,
          discord_username: discordUsername
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
        .eq('status', 'active') // Only check active mentorships to avoid finding old ended ones
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
      const instructorMention = instructorData?.discord_id ? `<@${instructorData.discord_id}>` : 'Unknown';
      const adminMessage = `✅ **STUDENT JOINED SUCCESSFULLY**\n\n` +
        `👤 **Student:** <@${userData.id}> (${userData.email})\n` +
        `👨‍🏫 **Instructor:** ${instructorMention}\n` +
        `📦 **Offer:** ${offerDetails?.offer_name || 'Unknown'}\n` +
        `📊 **Sessions:** ${sessionInfo}\n` +
        `🛒 **Purchased:** ${purchaseDate.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}\n` +
        `✅ **Joined:** ${joinDate.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}\n` +
        `⏱️ **Time to Join:** ${friendlyTimeToJoin}`;
      
      const sent = await discordApi.sendDM(CONFIG.DISCORD_ADMIN_ID, adminMessage);
      if (sent) {
        logger.info('Admin notification sent for successful join', { userId: userData.id, email: userData.email });
      }
    } catch (adminNotifyError) {
      logger.warn('Could not send admin notification', { 
        error: adminNotifyError instanceof Error ? adminNotifyError.message : String(adminNotifyError),
        userId: userData.id,
      });
    }

    // Send welcome DM to mentee
    try {
      const instructorMention = instructorData?.discord_id ? `<@${instructorData.discord_id}>` : 'your instructor';
      const welcomeMessage = `Welcome to the ${CONFIG.ORGANIZATION_NAME} Community! 🎉\n\n` +
        `You've been assigned the "1-on-1 Mentee" role -- this is needed so you can access the mentorship voice channels!\n\n` +
        `Your instructor is ${instructorMention}\n\n` +
        `Please inform them of your schedule so they can check their availability -- please include your time zone, as all our instructors and students are all over the world!\n\n` +
        `Having any issues? ${getSupportContactString()}`;
      
      const sent = await discordApi.sendDM(userData.id, welcomeMessage);
      if (sent) {
        logger.info('Welcome DM sent to mentee', { userId: userData.id, email: userData.email });
      }
    } catch (dmError) {
      logger.warn('Could not send DM to mentee', {
        error: dmError instanceof Error ? dmError.message : String(dmError),
        userId: userData.id,
      });
    }

    // Send notification DM to instructor
    if (instructorData?.discord_id) {
      try {
        const instructorMessage = `🎓 **New Mentee Alert!**\n\n` +
          `👤 **Student:** <@${userData.id}> (${userData.email})\n` +
          `📦 **Offer:** ${offerDetails?.offer_name || 'Unknown'}\n` +
          `📊 **Sessions:** ${sessionInfo}\n` +
          `🛒 **Purchased:** ${purchaseDate.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}\n` +
          `✅ **Joined:** ${joinDate.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}\n\n` +
          `Welcome your new student and help them schedule their first session!`;
        
        const sent = await discordApi.sendDM(instructorData.discord_id, instructorMessage);
        if (sent) {
          logger.info('Notification DM sent to instructor', {
            instructorId: instructorData.discord_id,
            userId: userData.id,
            email: userData.email,
          });
        }
      } catch (instructorDmError) {
        logger.warn('Could not send DM to instructor', {
          error: instructorDmError instanceof Error ? instructorDmError.message : String(instructorDmError),
          instructorId: instructorData.discord_id,
          userId: userData.id,
        });
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
    logger.error('OAuth callback error', error instanceof Error ? error : new Error(String(error)), {
      state: typeof state === 'string' ? state : undefined,
    });
    res.status(500).send('An error occurred during authentication');
  }
});

export default router;

