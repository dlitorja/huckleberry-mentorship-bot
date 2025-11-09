# Admin Notification Features

This document outlines all the admin notification features built into the Huckleberry Mentorship Bot.

## 🔔 Automatic Admin Notifications

The bot will automatically notify you via email or Discord DM for the following events:

### 1. 🛒 **Purchase Notification** (📧 Email)
**When:** Someone purchases a mentorship offer on Kajabi

**You'll receive an email at:** `huckleberryartinc@gmail.com`

**Email contains:**
- 👤 Student email
- 👨‍🏫 Instructor name
- 📦 Offer name
- 💰 Price
- ⏰ Timestamp
- 📧 Status: Invite email sent, waiting for Discord join

**Note:** If email sending fails, you'll receive a Discord DM as backup.

### 2. ✅ **Successful Join Notification**
**When:** A student successfully joins Discord via OAuth and gets their role

**You'll receive:**
```
✅ STUDENT JOINED SUCCESSFULLY

👤 Student: @Username (customer@email.com)
👨‍🏫 Instructor: @InstructorName
⏰ Time: 11/09/2025, 10:35:12 AM
```

### 3. ❌ **Error Alerts**
**When:** Something goes wrong in the onboarding process

**Types of errors you'll be notified about:**

#### 📧 Email Failed
```
📧 ERROR ALERT: EMAIL FAILED

⚠️ Message: Failed to send invite email via Resend
👤 Student: customer@email.com
⏰ Time: 11/09/2025, 10:30:45 AM

📋 Details:
[error details]
```

#### 🎭 Role Assignment Failed
```
🎭 ERROR ALERT: ROLE ASSIGNMENT FAILED

⚠️ Message: Failed to assign "1-on-1 Mentee" role
👤 Student: customer@email.com
⏰ Time: 11/09/2025, 10:35:12 AM

📋 Details:
[error details]
```

#### 💾 Database Error
```
💾 ERROR ALERT: DATABASE ERROR

⚠️ Message: Failed to store pending join in database
👤 Student: customer@email.com
⏰ Time: 11/09/2025, 10:30:45 AM

📋 Details:
[error details]
```

#### 🔗 Webhook Error (Unmapped Offer)
```
🔗 ERROR ALERT: WEBHOOK ERROR

⚠️ Message: Unmapped Kajabi offer received: 123456
👤 Student: customer@email.com
⏰ Time: 11/09/2025, 10:30:45 AM

📋 Details:
This offer needs to be added to the database.
```

### 4. ⏳ **Delayed Join Alerts**
**When:** You run `/alertdelayed` command (manual trigger)

**You'll receive:**
```
⏳ DELAYED JOIN ALERT

👤 Student: customer@email.com
👨‍🏫 Instructor: John Doe
📅 Purchase Date: 11/08/2025, 10:30:45 AM
⏱️ Time Since Purchase: 26 hours

This student received an invite but hasn't joined Discord yet. Consider reaching out!
```

---

## 🎮 Admin Commands

### `/checkpending`
**Description:** View all students who purchased but haven't joined Discord yet

**Response:** Shows an embed with:
- Total number of pending joins
- List of students with:
  - Email address
  - Assigned instructor
  - Time since purchase
  - Purchase date
- ⚠️ Warning indicator for joins older than 24 hours

**Usage:**
```
/checkpending
```

### `/alertdelayed`
**Description:** Send DM alerts for students who haven't joined after X hours

**Options:**
- `hours` (optional): Alert for joins older than X hours (default: 24)

**Usage:**
```
/alertdelayed
/alertdelayed hours:48
```

**What it does:**
- Finds all pending joins older than specified hours
- Sends you a DM for each one with details
- Suggests following up with the student

### `/dailysummary`
**Description:** Get a comprehensive summary of purchases and joins

**Options:**
- `days` (optional): Number of days to look back (default: 1)

**Response:** Shows an embed with:
- 🛒 Total Purchases
- ✅ Successful Joins
- ⏳ Pending Joins
- 📈 Join Rate percentage
- 👨‍🏫 Breakdown by instructor
- 🕐 Recent activity (last 5)

**Usage:**
```
/dailysummary
/dailysummary days:7
/dailysummary days:30
```

### `/adminsummary`
**Description:** View all active mentorships and session counts (existing command)

**Usage:**
```
/adminsummary
```

---

## 📊 Monitoring Workflow

### Daily Routine:
1. **Morning:** Run `/dailysummary` to see yesterday's activity
2. **Check:** Run `/checkpending` to see if anyone needs follow-up
3. **Alert:** Run `/alertdelayed` if you want DM reminders for delayed joins

### Weekly Routine:
1. Run `/dailysummary days:7` for weekly stats
2. Review instructor performance
3. Check join rates and identify issues

### When You Get Notified:
- **Purchase Alert (Email)** → Student purchased, wait for them to join
- **Successful Join (DM)** → Everything worked! Student is in Discord
- **Error Alert (DM)** → Something failed, investigate immediately
- **Delayed Join (DM)** → Student hasn't joined, consider reaching out

---

## 🎯 Best Practices

1. **Monitor your DMs** - All critical alerts come via DM
2. **Check pending joins daily** - Use `/checkpending` each morning
3. **Follow up on delays** - If someone doesn't join within 24 hours, reach out
4. **Investigate errors immediately** - Error DMs mean something needs fixing
5. **Review weekly summaries** - Track trends and instructor performance

---

## ⚙️ Configuration

The admin user is set via the `DISCORD_ADMIN_ID` environment variable.

**To change the admin:**
```bash
fly secrets set DISCORD_ADMIN_ID="new_discord_user_id"
```

---

## 🚨 Troubleshooting

**Not receiving DMs?**
1. Check that `DISCORD_ADMIN_ID` is set correctly
2. Make sure you haven't blocked the bot
3. Verify bot has permission to send DMs

**Commands not showing?**
- Run `npm run register` to register the new commands with Discord

**Want to test notifications?**
- Send a test webhook from Kajabi
- The admin DMs will fire immediately

---

## 📝 Summary

You now have complete visibility into:
- ✅ Every purchase (instant **email** to huckleberryartinc@gmail.com)
- ✅ Every successful join (instant **Discord DM**)
- ✅ Every error (instant **Discord DM** with details)
- ✅ Pending joins that need follow-up (manual check via commands)
- ✅ Daily/weekly statistics (on-demand via commands)

**You're always in the loop!** 🎉

### 📬 Notification Channels:
- **Email** (huckleberryartinc@gmail.com): Purchase alerts
- **Discord DM**: Join confirmations, errors, delayed join alerts
- **Commands**: On-demand summaries and checks

