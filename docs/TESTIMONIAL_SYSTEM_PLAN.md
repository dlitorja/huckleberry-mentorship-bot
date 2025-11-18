# Testimonial Request System - Implementation Plan

**Purpose:** Automatically request testimonials from students after their 3rd or 4th session

**Status:** Implemented (Quick Win live)  
**Priority:** Medium (nice-to-have, enhances marketing)  
**Estimated Time:** 1-2 days to implement

---

## 🎯 **Goals**

1. Automatically detect when a student completes their 3rd or 4th session
2. Send a friendly email requesting a testimonial
3. Provide an easy way for students to submit testimonials
4. Store testimonials in database for easy access
5. Optionally display testimonials on website

---

## 🔔 **Trigger Logic**

### **When to Send Testimonial Request:**

**Option A: After 3rd Session** (Recommended)
- Student has completed 3/4 sessions
- They've experienced enough to give meaningful feedback
- Still engaged in the program (higher response rate)
- You get feedback while relationship is fresh

**Option B: After 4th (Final) Session**
- Student completed entire program
- Full experience feedback
- May have lower response rate (program ended, less engaged)

**Option C: Admin Choice (Flexible)**
- Add toggle to `/session` command: `request_testimonial:true`
- Instructor decides when timing is right
- More manual but more control

**Recommendation:** **Option A (after 3rd session)** with Option C as backup

---

## 📧 **Email Design**

### **Subject Line:**
```
How's your mentorship going with [Instructor Name]? 🎨
```

### **Email Body:**
```html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1>We'd love to hear from you! 💬</h1>
  
  <p>Hi [Student First Name],</p>
  
  <p>You've completed 3 sessions with <strong>[Instructor Name]</strong> – 
  that's awesome progress! 🎉</p>
  
  <p>We're always looking to improve, and your feedback means the world to us. 
  Would you mind sharing your experience so far?</p>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="[Testimonial Form URL]" 
       style="display: inline-block; padding: 15px 32px; background-color: #5865F2; 
              color: white; text-decoration: none; border-radius: 5px; 
              font-size: 16px; font-weight: bold;">
      Share Your Experience (2 min)
    </a>
  </div>
  
  <p style="font-size: 14px; color: #666;">
    <strong>What we'd love to know:</strong>
  </p>
  <ul style="font-size: 14px; color: #666;">
    <li>How has the mentorship helped you improve?</li>
    <li>What's been most valuable?</li>
    <li>Would you recommend it to other artists?</li>
  </ul>
  
  <p style="font-size: 13px; color: #999; margin-top: 40px;">
    Your feedback helps us improve and helps other artists decide if our 
    mentorships are right for them. Thank you for being part of our community!
  </p>
</div>
```

---

## 💾 **Database Schema**

### **New Table: `testimonials`**

```sql
CREATE TABLE testimonials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mentorship_id UUID REFERENCES mentorships(id) NOT NULL,
  mentee_id UUID REFERENCES mentees(id) NOT NULL,
  instructor_id UUID REFERENCES instructors(id) NOT NULL,
  
  -- Testimonial content
  testimonial_text TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5), -- Optional star rating
  
  -- Metadata
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_number INTEGER, -- Which session # they were on when submitted
  
  -- Approval workflow
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES instructors(id), -- Admin who approved
  approved_at TIMESTAMP WITH TIME ZONE,
  
  -- Display options
  is_featured BOOLEAN DEFAULT false,
  display_on_website BOOLEAN DEFAULT false,
  display_name TEXT, -- Name to show publicly (may differ from account name)
  
  -- Contact info (optional, for follow-up)
  student_name TEXT,
  student_email TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_testimonials_mentorship ON testimonials(mentorship_id);
CREATE INDEX idx_testimonials_status ON testimonials(status);
CREATE INDEX idx_testimonials_featured ON testimonials(is_featured);
```

### **Track Request Sent:**

Add column to `mentorships` table:
```sql
ALTER TABLE mentorships 
ADD COLUMN testimonial_requested_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE mentorships 
ADD COLUMN testimonial_submitted BOOLEAN DEFAULT false;
```

Status: The `testimonial_requested_at` and `testimonial_submitted` columns are live via migration `20251116133000_add_testimonial_columns.sql`. Email requests are active when `TESTIMONIAL_FORM_URL` is configured and the trigger logic is enabled in the `/session` flow.

---

## 🛠️ **Implementation Plan**

### **Phase 1: Detection & Email Sending (Day 1)**

#### **Modify `/session` Command:**

Add logic after session update:

```typescript
// After updating session count
if (newCount === 1 || newCount === 0) { // Just completed 3rd or 4th session
  // Check if we've already requested testimonial
  const { data: mentorshipData } = await supabase
    .from('mentorships')
    .select('testimonial_requested_at, testimonial_submitted')
    .eq('id', data.id)
    .single();
  
  if (!mentorshipData.testimonial_requested_at && !mentorshipData.testimonial_submitted) {
    // Send testimonial request email
    await sendTestimonialRequest({
      menteeEmail: menteeData.email,
      menteeName: student.tag,
      instructorName: instructorData.name,
      sessionNumber: data.total_sessions - newCount, // 3 or 4
      mentorshipId: data.id
    });
    
    // Mark as requested
    await supabase
      .from('mentorships')
      .update({ testimonial_requested_at: new Date().toISOString() })
      .eq('id', data.id);
    
    console.log(`✅ Testimonial request sent to ${student.tag}`);
  }
}
```

---

### **Phase 2: Testimonial Submission Form (Day 1-2)**

#### **Option A: Simple External Form** (Easiest)

**Use Google Forms or Typeform:**
- Create form with fields:
  - Rating (1-5 stars)
  - Testimonial text
  - Name to display
  - Permission to use publicly
- Embed form link in email
- Manually copy testimonials to website

**Pros:**
- ✅ Quick setup (15 minutes)
- ✅ No coding needed
- ✅ Familiar interface for students

**Cons:**
- ❌ Manual data entry
- ❌ Not integrated with your system
- ❌ Can't auto-display on site

---

#### **Option B: Custom Web Form** (Better)

**Create dedicated page:** `app.huckleberry.art/testimonials/[token]`

**Form Fields:**
```tsx
<form>
  <textarea placeholder="Tell us about your experience..." />
  
  <select label="How would you rate your mentorship?">
    <option>⭐⭐⭐⭐⭐ 5 - Excellent</option>
    <option>⭐⭐⭐⭐ 4 - Very Good</option>
    <option>⭐⭐⭐ 3 - Good</option>
  </select>
  
  <input placeholder="Your name (as you'd like it displayed)" />
  
  <checkbox label="I give permission to display this on your website" />
  
  <button>Submit Testimonial</button>
</form>
```

**Pros:**
- ✅ Integrated with database
- ✅ Can auto-display on website
- ✅ Branded experience
- ✅ Can send thank-you email after submission

**Cons:**
- ⚠️ Requires web development (part of Phase 2)
- ⚠️ More time to build

---

#### **Option C: Discord Bot Form** (Quick Win)

Add `/submittestimonial` command:
```
/submittestimonial testimonial:"Your experience..." rating:5
```

**Pros:**
- ✅ Quick to implement (1-2 hours)
- ✅ Uses existing Discord infrastructure
- ✅ No web form needed

**Cons:**
- ❌ Less user-friendly than web form
- ❌ Students need to be in Discord
- ❌ Harder to edit after submission

---

### **Phase 3: Admin Review & Approval (Day 2)**

#### **Discord Command: `/reviewtestimonials`**

Shows pending testimonials:
```
📝 Pending Testimonials (3)

1. @StudentName - ⭐⭐⭐⭐⭐
   "The mentorship was exactly what I needed..."
   [Approve] [Reject] [Feature]

2. @AnotherStudent - ⭐⭐⭐⭐
   "Great experience, learned so much..."
   [Approve] [Reject] [Feature]
```

Buttons/commands:
- `/approvetestimonial id:123` - Approve for website
- `/rejecttestimonial id:123` - Don't display (spam/inappropriate)
- `/featuretestimonial id:123` - Feature on homepage

---

### **Phase 4: Display on Website (Day 2)**

#### **Option A: Static Export**

Generate JSON file with approved testimonials:
```json
[
  {
    "name": "Delia Williams",
    "rating": 5,
    "text": "The mentorship was exactly what I needed...",
    "instructor": "Neil Gray",
    "date": "2025-11-09"
  }
]
```

Update Kajabi site manually with new testimonials.

---

#### **Option B: Dynamic Widget** (Phase 2 Web App)

Create API endpoint: `GET /api/testimonials/featured`

Embed on Kajabi site:
```html
<div id="testimonials"></div>
<script src="https://app.huckleberry.art/testimonials.js"></script>
```

**Pros:**
- ✅ Auto-updates when you approve new testimonials
- ✅ No manual copy-paste
- ✅ Can rotate/randomize display

---

#### **Option C: Direct Integration** (Phase 2)

Testimonials section in web portal:
- Students see their own submissions
- Instructors see their students' testimonials
- Admin dashboard shows all pending/approved
- Public page: `app.huckleberry.art/testimonials` (showcases all)

---

## 🚀 **Recommended Implementation Path**

### **Quick Win (Live):**

1. **Modify `/session` command** to detect 3rd/4th session
2. **Send email via Resend** with Google Forms link
3. **Manual collection** → Copy testimonials to Kajabi site

**Time:** 2-3 hours  
**Effort:** Low  
**Value:** Immediate testimonial collection (currently in production)

---

### **Full Implementation (Phase 2):**

1. **Build web form** for testimonial submission
2. **Add approval workflow** with Discord commands
3. **Create API** for featured testimonials
4. **Embed widget** on Kajabi site for auto-display

**Time:** 2-3 days  
**Effort:** Medium  
**Value:** Fully automated testimonial system

---

## 📋 **Detailed Implementation (Quick Win)**

Let me create the code for the quick win approach:

### **Step 1: Create Testimonial Request Utility**

```typescript
// src/utils/testimonialRequest.ts

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendTestimonialRequest(options: {
  menteeEmail: string;
  menteeName: string;
  instructorName: string;
  sessionNumber: number;
}) {
  const { menteeEmail, menteeName, instructorName, sessionNumber } = options;
  
  // Google Form URL (you'll create this)
  const formUrl = process.env.TESTIMONIAL_FORM_URL || 'https://forms.gle/YOUR_FORM_ID';
  
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: menteeEmail,
      subject: `How's your mentorship going with ${instructorName}? 🎨`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #5865F2;">We'd love to hear from you! 💬</h1>
          
          <p>Hi ${menteeName.split('#')[0]},</p>
          
          <p>You've completed <strong>${sessionNumber} sessions</strong> with 
          <strong>${instructorName}</strong> – that's awesome progress! 🎉</p>
          
          <p>We're always looking to improve, and your feedback means the world to us. 
          Would you mind sharing your experience so far?</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${formUrl}" 
               style="display: inline-block; padding: 15px 32px; background-color: #5865F2; 
                      color: white; text-decoration: none; border-radius: 5px; 
                      font-size: 16px; font-weight: bold;">
              Share Your Experience (2 min)
            </a>
          </div>
          
          <p style="font-size: 14px; color: #666;">
            <strong>We'd love to know:</strong>
          </p>
          <ul style="font-size: 14px; color: #666;">
            <li>How has the mentorship helped you improve?</li>
            <li>What's been most valuable to you?</li>
            <li>Would you recommend it to other artists?</li>
          </ul>
          
          <p style="font-size: 13px; color: #999; margin-top: 40px;">
            Your feedback helps us improve and helps other artists decide if our 
            mentorships are right for them. Thank you for being part of our community! ❤️
          </p>
        </div>
      `
    });
    
    console.log(`✅ Testimonial request sent to ${menteeEmail}`);
    return true;
  } catch (error) {
    console.error('Failed to send testimonial request:', error);
    return false;
  }
}
```

### **Step 2: Modify `/session` Command**

Add this after the session update:

```typescript
// Check if this is the 3rd session completion (1 session remaining)
const isThirdSession = newCount === 1;

if (isThirdSession) {
  // Check if we haven't already requested
  const { data: mentorshipCheck } = await supabase
    .from('mentorships')
    .select('testimonial_requested_at, testimonial_submitted')
    .eq('id', data.id)
    .single();
  
  if (!mentorshipCheck?.testimonial_requested_at && !mentorshipCheck?.testimonial_submitted) {
    // Get mentee email
    const { data: menteeDetails } = await supabase
      .from('mentees')
      .select('email')
      .eq('id', menteeData.id)
      .single();
    
    if (menteeDetails?.email) {
      // Send testimonial request
      const sent = await sendTestimonialRequest({
        menteeEmail: menteeDetails.email,
        menteeName: student.tag,
        instructorName: 'your instructor', // Get from instructor table
        sessionNumber: 3
      });
      
      if (sent) {
        // Mark as requested
        await supabase
          .from('mentorships')
          .update({ testimonial_requested_at: new Date().toISOString() })
          .eq('id', data.id);
        
        // Optional: Notify in Discord response
        message += '\n\n📧 Testimonial request sent!';
      }
    }
  }
}
```

---

## 📝 **Google Forms Setup (Quick Win Path)**

### **Create Google Form:**

1. Go to https://forms.google.com
2. Create new form: "Huckleberry Art Mentorship Testimonial"
3. Add fields:
   - **Your Name** (Short answer)
   - **Your Instructor** (Dropdown: list all instructors)
   - **Rate your experience** (Linear scale: 1-5 stars)
   - **Tell us about your experience** (Paragraph, required)
   - **What's been most valuable?** (Paragraph)
   - **Would you recommend this to other artists?** (Multiple choice: Yes/No/Maybe)
   - **Can we display this on our website?** (Multiple choice: Yes/No/Only with pseudonym)
   - **If yes, what name should we display?** (Short answer, optional)

4. Get shareable link
5. Add to environment variable: `TESTIMONIAL_FORM_URL=https://forms.gle/YOUR_ID`

### **View Responses:**

- Google Forms automatically collects in spreadsheet
- Export as CSV
- Copy best testimonials to Kajabi site manually

---

## 🌐 **Web Form Implementation (Phase 2 Path)**

### **Custom Form Page:**

**URL:** `app.huckleberry.art/testimonial/[unique-token]`

**Why token?**
- Pre-fills student/instructor info
- Prevents spam
- One-time use link

**Database for Tokens:**
```sql
CREATE TABLE testimonial_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT UNIQUE NOT NULL,
  mentorship_id UUID REFERENCES mentorships(id),
  expires_at TIMESTAMP WITH TIME ZONE,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Generate token in email:**
```typescript
const token = crypto.randomUUID();
await supabase.from('testimonial_tokens').insert({
  token,
  mentorship_id: data.id,
  expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
});

const formUrl = `https://app.huckleberry.art/testimonial/${token}`;
```

**Form submits to:** `POST /api/testimonials/submit`

---

## 🎨 **Admin Workflow**

### **Review Testimonials:**

#### **Discord Command: `/reviewtestimonials`**

Shows all pending:
```
📝 Pending Testimonials (2)

1. Sarah Lee → Neil Gray (⭐⭐⭐⭐⭐)
   "The mentorship transformed my art. Neil's 
   feedback on composition was invaluable..."
   
   /approvetestimonial id:1
   /rejecttestimonial id:1

2. John Doe → Rakasa (⭐⭐⭐⭐)
   "Great experience. Really helped me with..."
   
   /approvetestimonial id:2
   /rejecttestimonial id:2
```

#### **Approve Command:**
```typescript
/approvetestimonial id:123 featured:true display_name:"Sarah L."
```

Updates testimonial:
- `status` → 'approved'
- `approved_by` → admin ID
- `is_featured` → true
- `display_name` → "Sarah L."
- `display_on_website` → true

---

## 📊 **Analytics & Insights**

Track testimonial metrics:
- Response rate (requests sent vs submitted)
- Average rating by instructor
- Most common positive themes
- Identify areas for improvement

**Command: `/testimonialstats`**
```
📊 Testimonial Statistics

Total Sent: 45
Submitted: 23 (51% response rate)
Average Rating: 4.7 ⭐

By Instructor:
• Neil Gray: 12 testimonials, 4.8 avg ⭐
• Rakasa: 8 testimonials, 4.6 avg ⭐
• Ash Kirk: 3 testimonials, 5.0 avg ⭐

Pending Review: 2
```

---

## 🎯 **Recommended Approach**

### **Start with Quick Win (This Week):**

1. ✅ Create Google Form (15 minutes)
2. ✅ Add `testimonial_requested_at` column to database (5 minutes)
3. ✅ Modify `/session` command to detect 3rd session (30 minutes)
4. ✅ Send email with Google Form link (30 minutes)
5. ✅ Collect responses via Google Sheets
6. ✅ Manually add best ones to Kajabi

**Total Time:** ~2 hours  
**Result:** Start collecting testimonials immediately!

---

### **Upgrade to Full System (Phase 2):**

1. Build custom web form
2. Add approval workflow
3. Auto-display on website
4. Analytics dashboard

**Total Time:** 2-3 days  
**Result:** Fully automated testimonial system

---

## 🔐 **Privacy & Permissions**

### **Important Considerations:**

- ✅ Always ask permission before displaying publicly
- ✅ Allow pseudonyms (first name + last initial)
- ✅ Give option to edit/remove later
- ✅ Don't share email addresses publicly
- ✅ Respect GDPR/privacy laws

### **Consent Text:**

```
☑️ I give permission for Huckleberry Art to display this testimonial 
   on their website and marketing materials.

☑️ I understand I can request removal at any time by contacting 
   support@huckleberry.art
```

---

## 💡 **Future Enhancements**

- Video testimonials (record and upload)
- Before/after portfolio showcase with testimonial
- Social media sharing (auto-post to Twitter/Instagram)
- Testimonial wall on website (all approved testimonials)
- Student dashboard showing their submitted testimonials
- Incentive program (submit testimonial → get bonus resource)

---

## ✅ **Next Steps**

When ready to implement:

### **Quick Win Path:**
1. Create Google Form
2. Add `TESTIMONIAL_FORM_URL` to environment variables
3. Run database migration (add columns to mentorships)
4. Modify `/session` command
5. Deploy to Fly.io
6. Test with real session

### **Full System Path:**
1. Implement as part of Phase 2 web interface
2. Build custom form page
3. Add approval workflow commands
4. Create display widget
5. Integrate with Kajabi

---

**Decision Point:** Which path do you prefer?
- 🏃 **Quick Win:** Google Forms + manual (start collecting now!)
- 🏗️ **Full System:** Wait for Phase 2 (integrated and automated)
- 🎯 **Hybrid:** Start with Google Forms, migrate to custom form in Phase 2

---

**I can implement the Quick Win in ~2 hours when you're ready!** 📝✨

