// src/server/oauthCallback.ts

import 'dotenv/config';
import express from 'express';
import fetch from 'node-fetch';
import { supabase } from '../bot/supabaseClient.js';

const router = express.Router();

// OAuth callback endpoint
router.get('/oauth/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('Missing authorization code');
  }

  try {
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

    const tokenData: any = await tokenResponse.json();

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

    const userData: any = await userResponse.json();
    console.log('User authenticated:', userData.email, userData.id);

    // Find pending join by email
    const { data: pendingJoin, error } = await supabase
      .from('pending_joins')
      .select('*')
      .eq('email', userData.email.toLowerCase())
      .is('discord_user_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !pendingJoin) {
      console.error('No pending join found for:', userData.email);
      return res.send(`
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>❌ No Purchase Found</h1>
            <p>We couldn't find a purchase associated with your email (${userData.email}).</p>
            <p>Please contact support at huckleberryartinc@gmail.com if you believe this is an error.</p>
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
    const roles: any = await rolesResponse.json();
    const menteeRole = roles.find((r: any) => r.name === '1-on-1 Mentee');

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
      } else {
        console.log(`✅ Successfully assigned "1-on-1 Mentee" role to ${userData.email}`);
      }
    }

    // Update pending join with Discord user ID
    await supabase
      .from('pending_joins')
      .update({
        discord_user_id: userData.id,
        joined_at: new Date().toISOString()
      })
      .eq('id', pendingJoin.id);

    // Get instructor Discord ID
    const { data: instructorData, error: instructorError } = await supabase
      .from('instructors')
      .select('discord_id')
      .eq('id', pendingJoin.instructor_id)
      .single();

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
      
      const menteeDmChannel: any = await menteeDmResponse.json();
      
      if (menteeDmChannel.id) {
        const instructorMention = instructorData?.discord_id ? `<@${instructorData.discord_id}>` : 'your instructor';
        await fetch(`https://discord.com/api/channels/${menteeDmChannel.id}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: `Welcome to the community! 🎉\n\nYou've been assigned the "1-on-1 Mentee" role.\nYour instructor is ${instructorMention}.`
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
        
        const instructorDmChannel: any = await instructorDmResponse.json();
        
        if (instructorDmChannel.id) {
          await fetch(`https://discord.com/api/channels/${instructorDmChannel.id}/messages`, {
            method: 'POST',
            headers: {
              Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              content: `🎓 New Mentee Alert!\n\n<@${userData.id}> (${userData.email}) has joined and been assigned to you.`
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

