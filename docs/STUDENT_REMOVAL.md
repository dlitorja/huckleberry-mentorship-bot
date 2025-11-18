# Student Removal Features

This guide explains how the bot automatically and manually removes the "1-on-1 Mentee" role when students cancel, get refunded, or their mentorship ends.

---

## 🤖 Automatic Removal (Kajabi Webhooks)

### How It Works

When a student cancels their subscription, gets refunded, or their subscription expires in Kajabi, the bot automatically:

1. ✅ Removes the "1-on-1 Mentee" Discord role
2. ✅ Updates the mentorship status to "ended" in the database
3. ✅ Sends a goodbye DM to the student
4. ✅ Notifies the admin via Discord DM
5. ✅ Logs the reason and timestamp

### Setup in Kajabi

For each offer that should trigger automatic removal:

1. Go to **Kajabi → Settings → Webhooks**
2. Create a new **Outbound Webhook**
3. Set **Webhook URL:** `https://your-app.fly.dev/webhook/kajabi/cancellation`
4. Enable these events:
   - `subscription.canceled`
   - `subscription.ended`
   - `subscription.expired`
   - `order.refunded`
5. Save the webhook

### Supported Events

| Event | What Triggers It | Removal Reason |
|-------|-----------------|----------------|
| `subscription.canceled` | Student manually cancels | "Subscription cancelled" |
| `subscription.ended` | Subscription naturally ends | "Subscription ended" |
| `subscription.expired` | Payment fails, subscription expires | "Subscription expired" |
| `order.refunded` | Order is refunded | "Order refunded" |

---

## 🛠️ Manual Removal (Admin Command)

### `/removestudent` Command

**Purpose:** Manually remove a student's role when needed

**Who Can Use:** Admins only (configured via `DISCORD_ADMIN_ID`)

### Usage

```
/removestudent student:@StudentName reason:"Completed mentorship" send_goodbye:true
```

### Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `student` | User | ✅ Yes | The Discord user to remove |
| `reason` | String | ❌ No | Why the role is being removed (default: "Mentorship ended") |
| `send_goodbye` | Boolean | ❌ No | Whether to send a goodbye DM (default: true) |

### Examples

**Basic usage:**
```
/removestudent student:@JohnDoe
```

**With custom reason:**
```
/removestudent student:@JaneDoe reason:"Graduated from program"
```

**Without sending goodbye DM:**
```
/removestudent student:@BobSmith reason:"Left Discord server" send_goodbye:false
```

---

## 📋 What Happens When a Student is Removed

### 1. Database Updates

The mentorship record is updated with:
- `status`: Changed from "active" to "ended"
- `ended_at`: Current timestamp
- `end_reason`: Reason provided (e.g., "Subscription cancelled")

**Note:** The mentorship record is **not deleted**, just marked as ended. This preserves history for analytics.

### 2. Discord Role Removal

The "1-on-1 Mentee" role is removed from the student's Discord account.

**If the student has already left the server:**
- The bot gracefully handles this and continues
- No error is thrown
- Admin is still notified

### 3. Goodbye DM (Optional)

The student receives a DM:

```
👋 Thank you for being part of [Your Organization]!

Your 1-on-1 mentorship has ended: [Reason]

We hope you've had a valuable experience and wish you the best 
in your artistic journey! 🎨

You're always welcome to rejoin us in the future.

Questions? Email us at support@yourdomain.com or send a DM to Admin (@YourAdmin)
```

### 4. Admin Notification

The admin receives a Discord DM:

```
🔴 Student Removed

@StudentName (student@email.com)
Reason: Subscription cancelled
Time: Jan 15, 2025, 2:30 PM

The 1-on-1 Mentee role has been removed.
```

---

## 🗄️ Database Schema

### Added Columns to `mentorships` Table

Run `database/add_mentorship_status.sql` in Supabase:

```sql
ALTER TABLE mentorships 
ADD COLUMN status TEXT DEFAULT 'active';

ALTER TABLE mentorships 
ADD COLUMN ended_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE mentorships 
ADD COLUMN end_reason TEXT;
```

### Status Values

| Status | Meaning |
|--------|---------|
| `active` | Currently active mentorship (default) |
| `ended` | Mentorship ended normally |
| `cancelled` | Reserved for future use |

---

## 🔧 Troubleshooting

### Issue: Role Not Removed

**Possible Causes:**
1. Student already left the Discord server
2. "1-on-1 Mentee" role doesn't exist in the server
3. Bot lacks permissions to manage roles

**Solution:**
- Check bot has "Manage Roles" permission
- Ensure bot's role is higher than "1-on-1 Mentee" role in server settings
- Check logs for specific error messages

### Issue: Webhook Not Triggering

**Possible Causes:**
1. Webhook URL incorrect in Kajabi
2. Events not enabled for the webhook
3. Kajabi can't reach your server (firewall/down)

**Solution:**
- Verify webhook URL: `https://your-app.fly.dev/webhook/kajabi/cancellation`
- Test with Kajabi's "Send Test" button
- Check Fly.io logs: `fly logs`

### Issue: Student Not Found in Database

**Cause:** Student purchased but never joined Discord (never completed OAuth)

**Behavior:** Bot logs this and returns success (nothing to do)

**Solution:** This is expected behavior - no action needed

---

## 📊 Viewing Ended Mentorships

You can query ended mentorships in Supabase:

```sql
SELECT 
  mentees.email,
  mentees.discord_id,
  instructors.name AS instructor,
  mentorships.status,
  mentorships.ended_at,
  mentorships.end_reason
FROM mentorships
JOIN mentees ON mentorships.mentee_id = mentees.id
JOIN instructors ON mentorships.instructor_id = instructors.id
WHERE mentorships.status = 'ended'
ORDER BY mentorships.ended_at DESC;
```

---

## 🔐 Security Notes

- Only admins (via `DISCORD_ADMIN_ID`) can use `/removestudent`
- Kajabi webhook endpoint is public but validates incoming data
- Role removal requires Discord bot permissions
- All actions are logged for audit trails

---

## 🚀 Deployment

After implementing these features:

1. **Run database migration:**
   ```sql
   -- In Supabase SQL Editor:
   -- Run database/add_mentorship_status.sql
   ```

2. **Deploy to Fly.io:**
   ```bash
   fly deploy
   ```

3. **Register new command:**
   ```bash
   npm run register-commands
   ```

4. **Set up Kajabi webhooks:**
   - Configure cancellation webhook as described above
   - Test with a test order refund

5. **Test manually:**
   ```
   /removestudent student:@TestUser reason:"Testing removal feature"
   ```

---

## ✅ Checklist

- [ ] Database migration run (`add_mentorship_status.sql`)
- [ ] Code deployed to Fly.io
- [ ] Commands registered with Discord
- [ ] Kajabi cancellation webhooks configured
- [ ] `/removestudent` command tested
- [ ] Verified goodbye DMs are being sent
- [ ] Verified admin notifications working
- [ ] Checked logs for any errors

---

## 📚 Related Documentation

- [COMMANDS_SUMMARY.md](./COMMANDS_SUMMARY.md) - All Discord commands
- [KAJABI_SETUP.md](./KAJABI_SETUP.md) - Kajabi webhook setup
- [ADMIN_FEATURES.md](./ADMIN_FEATURES.md) - Admin notification system

---

## 💡 Future Enhancements

Potential improvements for future versions:

- **Automatic expiry check:** Daily cron job to check for students with 0 sessions for 30+ days
- **Grace period:** Option to keep role for X days after cancellation
- **Re-activation:** Automatic role re-assignment if student repurchases after cancellation
- **Analytics dashboard:** Web UI showing removal reasons, retention rates, etc.

