// src/utils/adminNotifications.ts
// Utility functions for sending admin notifications

import { Resend } from 'resend';

import { CONFIG } from '../config/constants.js';

const ADMIN_ID = CONFIG.DISCORD_ADMIN_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';

// Initialize Resend for admin emails
const resend = new Resend(process.env.RESEND_API_KEY);

interface PurchaseNotification {
  studentEmail: string;
  instructorName: string;
  offerName: string;
  offerPrice?: string;
}

interface ErrorNotification {
  type: 'email_failed' | 'role_assignment_failed' | 'database_error' | 'webhook_error' | 'cancellation_webhook_error' | 'role_removal_error';
  message: string;
  details?: unknown;
  studentEmail?: string;
  studentDiscordId?: string;
}

interface FailedJoinAlert {
  studentEmail: string;
  instructorName: string;
  hoursSincePurchase: number;
  purchaseDate: string;
}

/**
 * Send a DM to the admin
 */
async function sendAdminDM(content: string): Promise<boolean> {
  if (!ADMIN_ID) {
    console.error('Missing DISCORD_ADMIN_ID');
    return false;
  }

  try {
    // Use centralized Discord API utility
    const { discordApi } = await import('./discordApi.js');
    const sent = await discordApi.sendDM(ADMIN_ID, content);
    if (sent) {
      console.log('✅ Admin notification sent');
    }
    return sent;
  } catch (error) {
    console.error('Error sending admin DM:', error);
    return false;
  }
}

/**
 * Notify admin of a new purchase via email and Discord DM
 */
export async function notifyAdminPurchase(info: PurchaseNotification): Promise<void> {
  // Prepare the message content for both email and DM
  const dmMessage = `
🛒 **NEW PURCHASE ALERT**

👤 **Student:** ${info.studentEmail}
👨‍🏫 **Instructor:** ${info.instructorName}
📦 **Offer:** ${info.offerName}
${info.offerPrice ? `💰 **Price:** $${info.offerPrice}` : ''}
⏰ **Time:** ${new Date().toLocaleString()}

📧 Invite email has been sent. Waiting for student to join Discord...
  `.trim();

  // Send email
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: ADMIN_EMAIL,
      subject: `🛒 New Purchase: ${info.studentEmail}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #5865F2;">🛒 NEW PURCHASE ALERT</h2>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>👤 Student:</strong> ${info.studentEmail}</p>
            <p><strong>👨‍🏫 Instructor:</strong> ${info.instructorName}</p>
            <p><strong>📦 Offer:</strong> ${info.offerName}</p>
            ${info.offerPrice ? `<p><strong>💰 Price:</strong> $${info.offerPrice}</p>` : ''}
            <p><strong>⏰ Time:</strong> ${new Date().toLocaleString()}</p>
          </div>
          
          <div style="background-color: #e3f2fd; padding: 15px; border-left: 4px solid #2196F3; border-radius: 4px;">
            <p style="margin: 0;">📧 <strong>Status:</strong> Invite email has been sent to the student.</p>
            <p style="margin: 10px 0 0 0;">⏳ Waiting for student to join Discord...</p>
          </div>
          
          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            You'll receive another notification once the student joins Discord.
          </p>
        </div>
      `
    });

    if (error) {
      console.error('Failed to send admin purchase notification email:', error);
    } else {
      console.log('✅ Admin purchase notification email sent:', data?.id);
    }
  } catch (error) {
    console.error('Error sending admin purchase notification email:', error);
  }

  // Always send Discord DM (regardless of email success/failure)
  try {
    const dmSent = await sendAdminDM(dmMessage);
    if (dmSent) {
      console.log('✅ Admin purchase notification Discord DM sent');
    } else {
      console.error('⚠️ Failed to send admin purchase notification Discord DM');
    }
  } catch (error) {
    console.error('Error sending admin purchase notification Discord DM:', error);
  }
}

/**
 * Notify admin of an error
 */
export async function notifyAdminError(error: ErrorNotification): Promise<void> {
  const emoji: Record<ErrorNotification['type'], string> = {
    email_failed: '📧',
    role_assignment_failed: '🎭',
    database_error: '💾',
    webhook_error: '🔗',
    cancellation_webhook_error: '🔗',
    role_removal_error: '🎭'
  };

  let message = `
${emoji[error.type]} **ERROR ALERT: ${error.type.toUpperCase().replace(/_/g, ' ')}**

⚠️ **Message:** ${error.message}
${error.studentEmail ? `👤 **Student:** ${error.studentEmail}` : ''}
⏰ **Time:** ${new Date().toLocaleString()}
  `.trim();

  if (error.details) {
    const detailsStr = typeof error.details === 'string' 
      ? error.details 
      : JSON.stringify(error.details, null, 2).substring(0, 500);
    message += `\n\n📋 **Details:**\n\`\`\`\n${detailsStr}\n\`\`\``;
  }

  await sendAdminDM(message);
}

/**
 * Notify admin of students who haven't joined
 */
export async function notifyAdminFailedJoin(alert: FailedJoinAlert): Promise<void> {
  const message = `
⏳ **DELAYED JOIN ALERT**

👤 **Student:** ${alert.studentEmail}
👨‍🏫 **Instructor:** ${alert.instructorName}
📅 **Purchase Date:** ${alert.purchaseDate}
⏱️ **Time Since Purchase:** ${alert.hoursSincePurchase} hours

This student received an invite but hasn't joined Discord yet. Consider reaching out!
  `.trim();

  await sendAdminDM(message);
}

/**
 * Send daily summary to admin
 */
export async function sendDailySummary(stats: {
  newPurchases: number;
  successfulJoins: number;
  pendingJoins: number;
  errors: number;
}): Promise<void> {
  const message = `
📊 **DAILY SUMMARY - ${new Date().toLocaleDateString()}**

🛒 **New Purchases:** ${stats.newPurchases}
✅ **Successful Joins:** ${stats.successfulJoins}
⏳ **Pending Joins:** ${stats.pendingJoins}
❌ **Errors:** ${stats.errors}

${stats.pendingJoins > 0 ? '⚠️ Some students haven\'t joined yet. Use `/checkpending` for details.' : '✨ All purchases have joined successfully!'}
  `.trim();

  await sendAdminDM(message);
}

