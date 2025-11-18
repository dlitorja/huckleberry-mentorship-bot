# Alumni & Past Student Tracking System

**Purpose:** Track and re-engage past students using Supabase queries and CSV exports for Kajabi email campaigns

**Status:** ✅ Implemented  
**Approach:** Supabase Views + CSV Export (No Discord commands needed!)  
**Priority:** High (retention, repeat customers)  
**Estimated Time:** 10 minutes to set up

---

## 🎯 **Goals**

1. Easy visibility into all past students (ended mentorships)
2. Filter by: instructor, time since completion, sessions completed
3. Export as CSV for Kajabi email campaigns
4. Track which alumni return vs. stay dormant

---

## ✅ **What We Already Have**

Everything you need is already in the database!

**In `mentorships` Table:**
- ✅ Status ('active', 'ended')
- ✅ End reason, ended timestamp
- ✅ Session counts (total, remaining, completed)
- ✅ Last session date

**In `mentees` Table:**
- ✅ Email addresses
- ✅ Discord IDs

**In `instructors` Table:**
- ✅ Instructor names and IDs

---

## 🗄️ **Database Setup**

### **Add Tracking Columns (Optional)**

If you want to track returns and add admin notes:

```sql
-- Track if they returned after ending
ALTER TABLE mentorships
ADD COLUMN IF NOT EXISTS returned_after_end BOOLEAN DEFAULT false;

-- Add notes field for admin reference
ALTER TABLE mentorships
ADD COLUMN IF NOT EXISTS admin_notes TEXT;
```

**Run this in:** Supabase SQL Editor

**Benefits:**
- Track which alumni came back (for analytics)
- Add notes like "interested in returning in Q1 2026"

---

## 🎯 **Create Alumni Export View**

### **Main View: `alumni_export`**

Run this SQL in Supabase to create a permanent view:

**File:** `database/add_alumni_tracking.sql`

```sql
CREATE OR REPLACE VIEW alumni_export AS
SELECT 
  -- Contact Info
  mentees.email,
  mentees.discord_id,
  
  -- Instructor
  instructors.name AS instructor_name,
  instructors.discord_id AS instructor_discord_id,
  
  -- Session Stats
  mentorships.total_sessions,
  mentorships.sessions_remaining,
  (mentorships.total_sessions - mentorships.sessions_remaining) AS sessions_completed,
  
  -- Timing
  mentorships.ended_at,
  TO_CHAR(mentorships.ended_at, 'YYYY-MM-DD') AS ended_date_formatted,
  ROUND(EXTRACT(EPOCH FROM (NOW() - mentorships.ended_at)) / 2592000) AS months_since_ended,
  
  -- Context
  mentorships.end_reason,
  mentorships.last_session_date,
  TO_CHAR(mentorships.last_session_date, 'YYYY-MM-DD') AS last_session_formatted,
  
  -- Tracking
  mentorships.returned_after_end,
  mentorships.admin_notes,
  
  -- IDs (for reference)
  mentorships.id AS mentorship_id,
  mentees.id AS mentee_id,
  instructors.id AS instructor_id,
  
  -- Timestamps
  mentorships.created_at AS mentorship_started_at
  
FROM mentorships
JOIN mentees ON mentorships.mentee_id = mentees.id
JOIN instructors ON mentorships.instructor_id = instructors.id
WHERE mentorships.status = 'ended'
ORDER BY mentorships.ended_at DESC;
```

---

## 📥 **How to Export Alumni**

### **Method 1: Export Entire View (All Alumni)**

1. **Go to:** Supabase → Table Editor
2. **Find:** `alumni_export` (in Views section)
3. **Click:** Export button → Download CSV
4. **Done!** Import into Kajabi

---

### **Method 2: Export with Filters (Segmented Lists)**

Use filters in Supabase Table Editor:

#### **Filter 1: Prime Candidates (3-6 months ago)**
1. Open `alumni_export` view
2. Add filters:
   - `months_since_ended` ≥ 3
   - `months_since_ended` ≤ 6
   - `sessions_completed` ≥ 3
3. Export CSV

#### **Filter 2: Specific Instructor**
1. Open `alumni_export` view
2. Filter: `instructor_name` equals "Neil Gray"
3. Export CSV

#### **Filter 3: Completed All Sessions**
1. Open `alumni_export` view  
2. Filter: `sessions_remaining` equals 0
3. Export CSV

#### **Filter 4: Never Returned**
1. Open `alumni_export` view
2. Filter: `returned_after_end` equals false
3. Export CSV

---

### **Method 3: Custom SQL Queries**

For advanced filtering, run SQL directly:

#### **Prime Re-engagement Candidates:**
```sql
SELECT 
  email,
  instructor_name,
  sessions_completed,
  ended_date_formatted,
  months_since_ended
FROM alumni_export
WHERE months_since_ended BETWEEN 3 AND 6
  AND sessions_completed >= 3
  AND (returned_after_end IS NULL OR returned_after_end = false)
ORDER BY ended_date_formatted DESC;
```

**Click "Run" → Click "Download CSV"**

---

## 📋 **Workflow with Kajabi**

### **Your Complete Process:**

1. **Monthly Alumni Review:**
   - Open Supabase → `alumni_export` view
   - Apply filters (e.g., 3-6 months, completed 3+ sessions)
   - Export CSV

2. **Import to Kajabi:**
   - Go to Kajabi → People → Import
   - Upload CSV
   - Map columns (Email → Email, etc.)
   - Create tag: "Alumni - Q4 2025"

3. **Create Email Campaign:**
   - Kajabi → Marketing → Create Email
   - Target: Tag "Alumni - Q4 2025"
   - Write re-engagement email
   - Send via Kajabi

4. **Track Results:**
   - Kajabi tracks opens, clicks, conversions
   - When someone renews, webhook marks `returned_after_end: true`

5. **Next Month:**
   - Filter out returned alumni
   - Export new batch
   - Repeat!

---

## 📊 **Useful Saved Queries**

Save these in Supabase for quick reuse:

### **1. "Prime Re-engagement List"**
```sql
-- Name: Alumni - Prime (3-6mo, high completion)
SELECT 
  email,
  instructor_name,
  sessions_completed,
  ended_date_formatted AS ended_date,
  end_reason
FROM alumni_export
WHERE months_since_ended BETWEEN 3 AND 6
  AND sessions_completed >= 3
  AND COALESCE(returned_after_end, false) = false
ORDER BY ended_date_formatted DESC;
```

### **2. "Recent Alumni" (Check-in List)**
```sql
-- Name: Alumni - Recent (< 3mo)
SELECT 
  email,
  instructor_name,
  sessions_completed,
  ended_date_formatted
FROM alumni_export
WHERE months_since_ended < 3
ORDER BY ended_date_formatted DESC;
```

### **3. "Long-term Alumni" (Soft Touch)**
```sql
-- Name: Alumni - Long-term (6-12mo)
SELECT 
  email,
  instructor_name,
  sessions_completed,
  ended_date_formatted
FROM alumni_export
WHERE months_since_ended BETWEEN 6 AND 12
  AND COALESCE(returned_after_end, false) = false
ORDER BY ended_date_formatted DESC;
```

### **4. "Incomplete Alumni" (Understand Why)**
```sql
-- Name: Alumni - Incomplete (1-2 sessions only)
SELECT 
  email,
  instructor_name,
  sessions_completed,
  end_reason,
  ended_date_formatted
FROM alumni_export
WHERE sessions_completed <= 2
ORDER BY ended_date_formatted DESC;
```

---

## 🔄 **Auto-tracking Returns**

### **Already Built In!**

When a past student renews, your webhook (`src/server/webhookServer.ts`) now:
- ✅ Detects they're a returning student
- ✅ Reactivates mentorship (`status: 'active'`)
- ✅ Re-adds Discord role if removed
- ✅ Can mark `returned_after_end: true` (if you add the column)

**To enable return tracking:**

1. Run the optional column additions (see Database Setup above)
2. The webhook will automatically handle the rest!

---

## 📈 **Analytics Queries**

### **Return Rate:**
```sql
SELECT 
  COUNT(*) FILTER (WHERE returned_after_end = true) AS returned,
  COUNT(*) AS total_alumni,
  ROUND(100.0 * COUNT(*) FILTER (WHERE returned_after_end = true) / COUNT(*), 1) AS return_rate_percent
FROM alumni_export;
```

**Output:** "6 returned out of 47 alumni (12.8%)"

---

### **By Instructor:**
```sql
SELECT 
  instructor_name,
  COUNT(*) AS total_alumni,
  COUNT(*) FILTER (WHERE returned_after_end = true) AS returned,
  ROUND(100.0 * COUNT(*) FILTER (WHERE returned_after_end = true) / COUNT(*), 1) AS return_rate
FROM alumni_export
GROUP BY instructor_name
ORDER BY return_rate DESC;
```

---

### **Completion Rates:**
```sql
SELECT 
  CASE 
    WHEN sessions_completed = 4 THEN '4/4 (Full program)'
    WHEN sessions_completed = 3 THEN '3/4 (Most complete)'
    WHEN sessions_completed = 2 THEN '2/4 (Half)'
    WHEN sessions_completed = 1 THEN '1/4 (Early exit)'
    ELSE '0/4 (No sessions)'
  END AS completion_level,
  COUNT(*) AS count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS percentage
FROM alumni_export
GROUP BY sessions_completed
ORDER BY sessions_completed DESC;
```

---

## 🚀 **Implementation Steps**

### **1. Run SQL Migration (5 minutes)**

In Supabase SQL Editor, run:

**File:** `database/add_alumni_tracking.sql`

This creates:
- Optional tracking columns (`returned_after_end`, `admin_notes`)
- `alumni_export` view for easy CSV exports

---

### **2. Update Webhook to Track Returns (Optional)**

If you want to automatically track returns, update webhook:

```typescript
// In src/server/webhookServer.ts, in the returning student section:

await supabase
  .from('mentorships')
  .update({
    sessions_remaining: newSessionsRemaining,
    total_sessions: newTotalSessions,
    status: 'active',
    ended_at: null,
    end_reason: null,
    returned_after_end: true  // ← Add this line
  })
  .eq('id', mentorship.id);
```

---

### **3. Done! Start Exporting**

Go to Supabase → `alumni_export` view → Export CSV!

---

## 📊 **Common Use Cases**

### **Use Case 1: Quarterly Re-engagement Campaign**

**Goal:** Contact alumni who ended 3-6 months ago

**Steps:**
1. Open `alumni_export` in Supabase
2. Filter:
   - `months_since_ended` ≥ 3
   - `months_since_ended` ≤ 6
   - `sessions_completed` ≥ 3
3. Export CSV (maybe 15-20 people)
4. Import to Kajabi
5. Send "We miss you!" campaign

---

### **Use Case 2: Instructor-Specific Outreach**

**Goal:** Help Neil reach out to his past students

**Steps:**
1. Open `alumni_export`
2. Filter: `instructor_name` = "Neil Gray"
3. Export CSV
4. Share with Neil or send via Kajabi

---

### **Use Case 3: Holiday Special Campaign**

**Goal:** Offer discount to all alumni

**Steps:**
1. Open `alumni_export`
2. No filters (export all)
3. Import to Kajabi
4. Send holiday campaign: "20% off for returning students!"

---

### **Use Case 4: Understanding Dropoffs**

**Goal:** Why do students leave after 1-2 sessions?

**Steps:**
1. Open `alumni_export`
2. Filter: `sessions_completed` ≤ 2
3. Export CSV
4. Review end_reason column
5. Identify patterns (price? scheduling? expectations?)

---

## 📧 **Using CSV in Kajabi**

### **Import Alumni to Kajabi:**

1. **Kajabi → People → Import**
2. Upload your CSV file
3. Map columns:
   - `email` → Email
   - `instructor_name` → Custom field or tag
4. Add tag: "Alumni - Campaign Nov 2025"
5. Click Import

### **Send Campaign:**

1. **Kajabi → Marketing → Create Email**
2. **Subject:** "We'd love to have you back! 🎨"
3. **Recipients:** Tag = "Alumni - Campaign Nov 2025"
4. **Design your email** with Kajabi's tools
5. **Send or Schedule**

### **Track Results:**

Kajabi shows:
- Open rate
- Click rate
- Who opened/clicked
- When someone purchases again

---

## 🔄 **Automatic Return Tracking**

When an alumni renews, your webhook already:
1. ✅ Detects they're a returning student
2. ✅ Reactivates mentorship
3. ✅ Adds new sessions

**To also track returns:**

Add one line to `src/server/webhookServer.ts`:

```typescript
returned_after_end: true  // Mark that they came back!
```

Then you can filter out returned alumni from future campaigns:
```sql
WHERE returned_after_end = false  -- Haven't returned yet
```

---

## 💡 **Pro Tips**

### **1. Clean Your List**
Before exporting, consider:
- Filter out people who opted out of marketing
- Exclude recent alumni (< 1 month - too soon!)
- Focus on 3-6 month window (sweet spot)

### **2. Segment Your Campaigns**
Different messages for:
- **Completed all sessions:** "Ready for round 2?"
- **Incomplete (1-2 sessions):** "Want to give it another shot?"
- **By instructor:** Personalized from their instructor

### **3. Use Kajabi Tags**
After importing CSV, tag them:
- "Alumni - Nov 2025 Campaign"
- Don't re-contact in future exports

### **4. Track What Works**
Compare campaigns:
- Which time windows (3mo? 6mo?) get best response?
- Which messages convert best?
- Which instructors' alumni return most?

---

## 📋 **Quick Reference**

### **Monthly Alumni Campaign Checklist:**

- [ ] Open Supabase → `alumni_export` view
- [ ] Filter: 3-6 months, completed 3+ sessions, not returned
- [ ] Export CSV
- [ ] Import to Kajabi
- [ ] Add tag: "Alumni - [Month] [Year]"
- [ ] Create email in Kajabi
- [ ] Send to tagged group
- [ ] Monitor results in Kajabi
- [ ] Update admin_notes in Supabase for any responses

---

## ✅ **Setup Checklist**

- [ ] Run SQL migration (add `returned_after_end`, `admin_notes` columns)
- [ ] Create `alumni_export` view in Supabase
- [ ] Save common queries in Supabase for reuse
- [ ] Optional: Add `returned_after_end: true` to webhook code
- [ ] Optional: Deploy webhook update to Fly.io
- [ ] Test: Export a CSV and verify format
- [ ] Test: Import CSV to Kajabi and verify

---

## 💰 **Business Impact**

### **Potential Revenue Increase:**

**Current (example):**
- 47 alumni
- 13% return rate = 6 renewals/year

**With Targeted Outreach:**
- Same 47 alumni
- 25% return rate = 12 renewals/year
- **Double the alumni revenue!** 💰

**How:**
- Stay top-of-mind with regular campaigns
- Reach out at optimal time (3-6 months)
- Personalized by instructor
- Professional Kajabi emails

---

## 🎯 **Summary**

### **What You Get:**
- ✅ Easy alumni visibility via Supabase view
- ✅ One-click CSV export
- ✅ Smart filtering (time, instructor, completion)
- ✅ Kajabi integration for professional campaigns
- ✅ Automatic return tracking (when they renew)
- ✅ Analytics queries for insights

### **What You DON'T Need:**
- ❌ No Discord commands
- ❌ No bot email sending
- ❌ No complex tracking tables
- ❌ No additional coding (just SQL views)

### **Time to Set Up:**
- **10 minutes** to create view
- **5 minutes** per export
- **Use Kajabi for everything else!**

---

**Simple, powerful, and leverages tools you already have!** 🎉

