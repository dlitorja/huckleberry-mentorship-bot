# Phase 2: Web Interface - Implementation Plan

**Status:** Planning Phase  
**Timeline:** Start in 1+ days  
**Estimated Duration:** 2-4 weeks for MVP

---

## 🎯 **Goals**

Build a web interface where students and instructors can:
1. Upload and view images (artwork, references, homework)
2. View and add session notes (synced with Discord bot)
3. Track progress over time
4. Search and filter through mentorship history

---

## 🛠️ **Tech Stack (Option A - Next.js)**

### **Frontend & Backend**
- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui (optional, beautiful pre-built components)

### **Database & Storage**
- **Database:** Existing Supabase PostgreSQL (already set up!)
- **Image Storage:** Supabase Storage
- **Auth:** Discord OAuth (reuse existing flow)

### **Image Processing**
- **Client-side:** Browser-based compression before upload
- **Library:** browser-image-compression (reduces file size 80-90%)
- **Format:** Convert to WebP for optimal storage

### **Deployment**
- **Platform:** Vercel (free tier, built for Next.js)
- **Domain:** subdomain like `app.huckleberry.art` or `portal.huckleberry.art`

---

## 👥 **Access Control**

### **Students**
- ✅ View their own session notes
- ✅ View their own images
- ✅ Upload images to their sessions
- ✅ Add notes to their sessions
- ❌ Cannot see other students' data

### **Instructors**
- ✅ View all their assigned students
- ✅ Switch between students easily (dropdown or sidebar)
- ✅ View/upload images for any of their students
- ✅ Add notes for their students
- ❌ Cannot see other instructors' students

### **Admins**
- ✅ View all instructors and all students
- ✅ Switch between any instructor/student
- ✅ Full read/write access
- ✅ Analytics and overview dashboards

---

## 🗂️ **Database Schema Updates**

### **New Tables to Add:**

#### **`session_images`**
```sql
CREATE TABLE session_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_note_id UUID REFERENCES session_notes(id) ON DELETE CASCADE,
  mentorship_id UUID REFERENCES mentorships(id),
  uploaded_by UUID REFERENCES mentees(id) OR instructors(id), -- polymorphic
  uploader_type TEXT CHECK (uploader_type IN ('student', 'instructor', 'admin')),
  image_url TEXT NOT NULL, -- Supabase Storage URL
  thumbnail_url TEXT, -- Compressed thumbnail
  original_filename TEXT,
  file_size INTEGER, -- bytes
  mime_type TEXT,
  caption TEXT,
  tags TEXT[], -- ['anatomy', 'composition', 'reference']
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_session_images_note ON session_images(session_note_id);
CREATE INDEX idx_session_images_mentorship ON session_images(mentorship_id);
```

#### **`image_comments`** (Optional - for feedback)
```sql
CREATE TABLE image_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  image_id UUID REFERENCES session_images(id) ON DELETE CASCADE,
  user_id UUID, -- could be student or instructor
  user_type TEXT CHECK (user_type IN ('student', 'instructor', 'admin')),
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 📁 **Project Structure**

```
huckleberry-web-portal/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx          # Discord OAuth login
│   │   └── callback/
│   │       └── page.tsx          # OAuth callback handler
│   ├── (dashboard)/
│   │   ├── layout.tsx            # Shared layout with nav
│   │   ├── dashboard/
│   │   │   └── page.tsx          # Main dashboard
│   │   ├── sessions/
│   │   │   ├── page.tsx          # List of sessions
│   │   │   └── [id]/
│   │   │       └── page.tsx      # Session detail with images
│   │   ├── portfolio/
│   │   │   └── page.tsx          # Portfolio view (Phase 2.3)
│   │   └── students/             # Instructor/Admin only
│   │       ├── page.tsx          # Student selector
│   │       └── [id]/
│   │           └── page.tsx      # View student's data
│   ├── api/
│   │   ├── auth/
│   │   │   └── [...nextauth]/
│   │   │       └── route.ts      # NextAuth.js config
│   │   ├── sessions/
│   │   │   ├── route.ts          # GET sessions, POST new note
│   │   │   └── [id]/
│   │   │       └── route.ts      # GET/UPDATE specific session
│   │   ├── images/
│   │   │   ├── upload/
│   │   │   │   └── route.ts      # POST upload image
│   │   │   └── [id]/
│   │   │       └── route.ts      # GET/DELETE image
│   │   └── students/             # Instructor/Admin routes
│   │       └── route.ts
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Landing page
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── SessionCard.tsx
│   ├── ImageUploader.tsx
│   ├── ImageGallery.tsx
│   ├── SessionTimeline.tsx
│   ├── StudentSwitcher.tsx       # Instructor/Admin dropdown
│   └── Navbar.tsx
├── lib/
│   ├── supabase.ts               # Supabase client
│   ├── auth.ts                   # Auth helpers
│   ├── imageCompression.ts       # Client-side compression
│   └── permissions.ts            # Access control helpers
├── public/
├── .env.local
├── next.config.js
├── package.json
└── tsconfig.json
```

---

## 🚀 **Implementation Roadmap**

### **Phase 2.1: Foundation & Image Uploads** (Week 1-2)

#### **Day 1-2: Project Setup**
- [ ] Create Next.js project: `npx create-next-app@latest huckleberry-web-portal`
- [ ] Install dependencies (Supabase, Tailwind, shadcn/ui)
- [ ] Set up environment variables
- [ ] Configure Supabase client
- [ ] Set up Discord OAuth with NextAuth.js

#### **Day 3-4: Authentication & Layout**
- [ ] Build login page with Discord OAuth button
- [ ] Implement OAuth callback handler
- [ ] Create protected route middleware
- [ ] Build dashboard layout (navbar, sidebar)
- [ ] Create user context/state management

#### **Day 5-7: Session Notes View**
- [ ] API route: GET sessions for current user
- [ ] Sessions list page (timeline view)
- [ ] Session detail page (view notes and links)
- [ ] Permission checks (students see own, instructors see their students)

#### **Day 8-10: Image Upload (with Drag-and-Drop!)**
- [ ] Set up Supabase Storage bucket for images
- [ ] **Build ImageUploader component with drag-and-drop support**
  - [ ] Use React Dropzone library (easy drag-and-drop)
  - [ ] Support dragging files from desktop
  - [ ] Also support click-to-browse (traditional upload)
  - [ ] Multi-file upload (drag multiple images at once)
  - [ ] Show preview thumbnails before uploading
  - [ ] File type validation (images only)
- [ ] Implement client-side image compression (before upload)
- [ ] API route: POST upload image with validation
- [ ] **Enforce 25 image limit per session (students/instructors only)**
- [ ] Display image counter: "12/25 images uploaded"
- [ ] Disable upload button when limit reached (non-admins)
- [ ] Link images to session notes
- [ ] Display uploaded images in gallery

**Drag-and-Drop is EASY and will be included!** ✅

#### **Day 11-14: Image Gallery & Polish**
- [ ] Build ImageGallery component with lightbox
- [ ] Add image captions
- [ ] Thumbnail generation
- [ ] Delete image functionality
- [ ] Mobile responsive design
- [ ] Loading states and error handling

---

### **Phase 2.2: Enhanced Features** (Week 3)

#### **Rich Text Notes**
- [ ] Replace plain text with rich text editor (Tiptap or Lexical)
- [ ] Sync rich notes back to Discord (plain text summary)
- [ ] Formatting toolbar (bold, italic, lists, etc.)

#### **Image Comments/Feedback**
- [ ] Add comments on images
- [ ] Instructor feedback system
- [ ] Reply threads

#### **Search & Filter** ✅ **COMPLETE**
- [x] Search across notes and image captions
- [x] Filter by date range
- [x] Filter by tags (database column added, API ready)
- [x] Quick search in navbar

#### **Student/Instructor Switcher**
- [ ] Dropdown to switch between students (instructors)
- [ ] Dropdown to switch between any user (admins)
- [ ] Recent students quick access
- [ ] Search students by name

---

### **Phase 2.3: Progress & Analytics** (Week 4+)

#### **Portfolio View**
- [ ] Gallery view of all student images
- [ ] Before/after comparison slider
- [ ] Filter by date/topic
- [ ] Export portfolio as PDF

#### **Progress Tracking**
- [ ] Sessions completed chart (line graph)
- [ ] Images uploaded over time
- [ ] Topics covered breakdown
- [ ] Milestones/achievements

#### **Analytics Dashboard** (Admin)
- [ ] Total sessions across all instructors
- [ ] Most active students
- [ ] Average images per session
- [ ] Instructor performance metrics

---

## 🎨 **UI/UX Design Principles**

### **Design System**
- **Colors:** Match Discord bot personality (blues, purples, warm accents)
- **Typography:** Clean, readable fonts (Inter, Space Grotesk)
- **Components:** shadcn/ui for consistency and speed
- **Animations:** Subtle, smooth (Framer Motion)

### **Key Pages Wireframes**

#### **Dashboard (Student)**
```
┌─────────────────────────────────────────┐
│  [Logo] Dashboard    Upload  [@User ▼] │
├─────────────────────────────────────────┤
│                                         │
│  📊 Your Progress                       │
│  ├─ 3/4 Sessions Completed              │
│  ├─ 12 Images Uploaded                  │
│  └─ Last Session: Nov 9, 2025           │
│                                         │
│  📅 Recent Sessions                     │
│  ┌──────────────────────────────────┐  │
│  │ Nov 9 - Composition Study        │  │
│  │ 🖼️🖼️🖼️ (3 images)              │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ Nov 2 - Color Theory Practice    │  │
│  │ 🖼️🖼️ (2 images)                 │  │
│  └──────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

#### **Session Detail Page**
```
┌─────────────────────────────────────────┐
│  ← Back to Sessions                     │
├─────────────────────────────────────────┤
│  📅 Nov 9, 2025 - Composition Study     │
│  👨‍🏫 Instructor: @Neil                   │
│                                         │
│  📝 Session Notes:                      │
│  ┌──────────────────────────────────┐  │
│  │ Discussed rule of thirds and      │  │
│  │ leading lines. Student showed     │  │
│  │ great improvement in composition. │  │
│  └──────────────────────────────────┘  │
│                                         │
│  🔗 Resources:                          │
│  • Tutorial: Rule of Thirds            │
│                                         │
│  🖼️ Images (3/25):                     │
│  ┌─────┐ ┌─────┐ ┌─────┐              │
│  │ IMG │ │ IMG │ │ IMG │ [+ Upload]   │
│  └─────┘ └─────┘ └─────┘              │
│  💡 22 images remaining in this session│
│                                         │
└─────────────────────────────────────────┘
```

#### **Instructor Dashboard**
```
┌─────────────────────────────────────────┐
│  [Logo] Dashboard   [Student: Jane ▼]  │
├─────────────────────────────────────────┤
│  👥 Your Students (5)                   │
│  ┌──────────────────────────────────┐  │
│  │ • Jane Doe (3/4 sessions)        │  │
│  │ • John Smith (1/4 sessions)      │  │
│  │ • Sarah Lee (4/4 sessions)       │  │
│  │ • Mike Chen (2/4 sessions)       │  │
│  │ • Emma Wilson (0/4 sessions) ⚠️  │  │
│  └──────────────────────────────────┘  │
│                                         │
│  📊 Jane Doe's Progress                 │
│  [Rest similar to student dashboard]    │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🔐 **Security Considerations**

### **Authentication**
- Discord OAuth for all users
- Session tokens (httpOnly cookies)
- CSRF protection (built into Next.js)

### **Authorization**
- Server-side permission checks on all API routes
- Row-level security in Supabase (students see own data)
- Admin middleware for admin-only routes

### **File Upload**
- File type validation (only images: jpg, png, webp)
- File size limit (10MB max before compression)
- **Per-session image limit: 25 images for students/instructors, unlimited for admins**
- Malware scanning (optional: ClamAV or VirusTotal API)
- Unique filenames (UUIDs) to prevent collisions

### **Rate Limiting**
- **Image limits per session:**
  - Students: 25 images max per session
  - Instructors: 25 images max per session
  - Admins: Unlimited
- API rate limiting (Vercel handles this)
- Display counter in UI: "12/25 images uploaded"

---

## 💾 **Data Sync Strategy**

### **Discord Bot ↔ Web Interface**

**Two-way sync:**
1. Discord command `/addnote` → Creates note in database → Shows in web
2. Web interface "Add Note" → Creates note in database → Optionally posts to Discord
3. Images uploaded on web → Optionally DM link to instructor/student

**Implementation:**
- Shared database (Supabase) is source of truth
- Both systems read/write to same tables
- Web doesn't need webhook server (direct DB access)

---

## 📊 **Image Storage Strategy**

### **Supabase Storage Setup**
```typescript
// Storage bucket structure
mentorship-images/
  ├── {mentorship_id}/
  │   ├── {session_note_id}/
  │   │   ├── {image_id}_original.webp
  │   │   └── {image_id}_thumbnail.webp
```

### **Compression Pipeline**
1. User selects image in browser
2. Client-side compression (browser-image-compression)
3. Convert to WebP format
4. Generate thumbnail (300px max dimension)
5. Upload both original (compressed) and thumbnail
6. Store URLs in database

**Result:** 
- 5MB photo → ~500KB compressed → ~50KB thumbnail
- 1GB storage = ~2,000 full images + thumbnails

### **Storage Cost Analysis with 25 Image Limit**

**Per Session:**
- 25 images × 500KB (compressed) = 12.5MB per session
- 25 thumbnails × 50KB = 1.25MB per session
- **Total per session: ~13.75MB**

**Projected Usage:**
- 10 students × 4 sessions = 40 sessions
- 40 sessions × 13.75MB = 550MB
- **Well within Supabase's 1GB free tier!**

**Why 25 Images is Reasonable:**
- Most sessions will have 3-10 images (homework, references, progress shots)
- 25 is a generous buffer for comprehensive portfolio sessions
- Prevents accidental bulk uploads or abuse
- Students can delete old images if they need more space
- Admins have unlimited for special cases (portfolios, exhibitions)

**Cost Savings:**
- Without limit: Risk of filling 1GB quickly
- With 25/session limit: 1GB supports 72+ sessions (~18 students with 4 sessions each)
- Keeps you in free tier for years!

---

## 🗑️ **Image Lifecycle & Purge System**

### **Automatic Storage Cleanup for Inactive Alumni**

**Purpose:** Free up storage by purging images from past students who haven't returned

**Policy:**
- **Active students:** Images kept indefinitely ✅
- **Alumni (< 16 months):** Images kept (they might return soon) ✅
- **Alumni (16-17 months):** Warning emails sent ⚠️
- **Alumni (18+ months):** Images purged, free up storage 🗑️

**Chosen Retention:** **18 months** (balanced approach)

### **Implementation Plan:**

#### **Database Schema:**

```sql
-- Track image purge status
CREATE TABLE image_purge_schedule (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mentee_id UUID REFERENCES mentees(id) NOT NULL,
  mentorship_id UUID REFERENCES mentorships(id),
  
  -- Purge timeline
  eligible_for_purge_at TIMESTAMP WITH TIME ZONE, -- When they become eligible (18mo after end)
  warning_sent_at TIMESTAMP WITH TIME ZONE,        -- When we sent warning email
  purge_executed_at TIMESTAMP WITH TIME ZONE,      -- When images were deleted
  
  -- Extension tracking (60-day one-time extension)
  extension_granted BOOLEAN DEFAULT false,         -- Whether they used their extension
  extended_at TIMESTAMP WITH TIME ZONE,            -- When extension was granted
  extension_days INTEGER DEFAULT 60,               -- How many days granted (60)
  
  -- Stats
  images_count INTEGER,                            -- How many images will be purged
  storage_size_mb DECIMAL,                         -- MB to be freed
  
  -- Status
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'warned', 'extended', 'purged', 'cancelled')),
  cancelled_reason TEXT,                           -- If they renewed, mark cancelled
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### **Monthly Cron Job (Automated):**

Run via Supabase Functions or GitHub Actions once per month:

```typescript
// 1. Send warning emails (2 months before purge = 16 months after end)
const studentsToWarn = await getAlumni({
  monthsSinceEnded: 16,
  hasImages: true,
  warningNotSent: true
});

for (const student of studentsToWarn) {
  await sendPurgeWarningEmail(student);
  // Mark warning sent
}

// 2. Execute purge (18 months after end, or 20 if extended)
const studentsToPurge = await supabase
  .from('image_purge_schedule')
  .select('*, mentees(email, discord_id), mentorships(*)')
  .eq('status', 'warned')
  .lte('eligible_for_purge_at', new Date().toISOString());

for (const student of studentsToPurge.data || []) {
  // Double-check they didn't extend or renew
  if (student.extension_granted) {
    console.log(`Skipping purge - extension granted for ${student.mentees.email}`);
    continue;
  }
  if (student.mentorships.status === 'active') {
    console.log(`Skipping purge - student renewed: ${student.mentees.email}`);
    await cancelPurge(student.id, 'Student renewed');
    continue;
  }
  
  // Execute purge
  await purgeStudentImages(student);
}
```

#### **Warning Email Template:**

**Subject:** Action Required: Download Your Mentorship Images 📸

**Body:**
```html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1>📸 Your Mentorship Images</h1>
  
  <p>Hi [Name],</p>
  
  <p>We hope you're doing well on your art journey! 🎨</p>
  
  <p>This is a friendly heads-up that you have <strong>[X] images</strong> 
  from your mentorship with <strong>[Instructor Name]</strong> stored in our system 
  from [Date Range].</p>
  
  <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; 
              margin: 20px 0; border-left: 4px solid #ffc107;">
    <p style="margin: 0;"><strong>⏰ Important:</strong></p>
    <p style="margin: 10px 0 0 0;">
      These images will be automatically deleted on <strong>[Purge Date]</strong> 
      (in 2 months) as part of our data retention policy.
    </p>
  </div>
  
  <p><strong>Want to keep them?</strong> Simply download your images before the purge date:</p>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="https://app.huckleberry.art/download-archive/[token]" 
       style="display: inline-block; padding: 15px 32px; background-color: #5865F2; 
              color: white; text-decoration: none; border-radius: 5px; 
              font-size: 16px; font-weight: bold;">
      Download All My Images
    </a>
  </div>
  
  <p style="font-size: 14px; color: #666;">
    Your download includes:
  </p>
  <ul style="font-size: 14px; color: #666;">
    <li>All images you uploaded during your mentorship</li>
    <li>Session notes and dates</li>
    <li>Resource links</li>
    <li>Organized by session in a ZIP file</li>
  </ul>
  
  <div style="background-color: #f0f7ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0; font-size: 14px;">
      <strong>Need more time?</strong>
    </p>
    <p style="margin: 10px 0 0 0; font-size: 14px;">
      Click here for a one-time 60-day extension:
    </p>
    <div style="text-align: center; margin: 15px 0 0 0;">
      <a href="https://app.huckleberry.art/extend-retention/[token]" 
         style="display: inline-block; padding: 10px 24px; background-color: #28a745; 
                color: white; text-decoration: none; border-radius: 5px; 
                font-size: 14px; font-weight: bold;">
        Extend by 60 Days
      </a>
    </div>
    <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">
      (Make sure to download before the extension expires!)
    </p>
  </div>
  
  <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
  
  <p style="font-size: 13px; color: #999;">
    <strong>Why are we doing this?</strong><br>
    We maintain free storage for all active students, but need to manage data 
    for our alumni to keep the service sustainable. Thank you for understanding!
  </p>
  
  <p style="font-size: 13px; color: #999;">
    Questions? Email us at support@huckleberry.art
  </p>
</div>
```

**Tone:** Helpful and matter-of-fact, not salesy

---

### **Download Archive Feature:**

**Endpoint:** `GET /download-archive/[token]`

**What It Does:**
1. Validates token (time-limited, one-time use)
2. Fetches all student's images
3. Creates ZIP file with folder structure:
   ```
   StudentName_Mentorship_Archive/
   ├── Session_2025-06-15/
   │   ├── notes.txt
   │   ├── image_001.jpg
   │   ├── image_002.jpg
   │   └── links.txt
   ├── Session_2025-07-01/
   │   ├── notes.txt
   │   └── image_001.jpg
   └── README.txt (summary of mentorship)
   ```
4. Streams ZIP download to browser
5. Marks download as completed (prevents re-download if already saved)

---

### **60-Day Extension Feature:**

**Endpoint:** `GET /extend-retention/[token]`

**What It Does:**
1. Validates token (one-time use, expires after click)
2. Checks if extension already used (limit 1 extension)
3. Adds 60 days to purge date
4. Updates `image_purge_schedule` table:
   ```typescript
   eligible_for_purge_at = current_purge_date + 60 days
   status = 'extended'
   extended_at = NOW()
   ```
5. Shows confirmation page:
   ```
   ✅ Extension Granted!
   
   Your images are now safe until [New Date].
   
   Please download your archive before this date - 
   no further extensions are available.
   
   [Download Archive Now]
   ```
6. Sends confirmation email with new deadline

**Database Tracking:**
```sql
ALTER TABLE image_purge_schedule
ADD COLUMN extension_granted BOOLEAN DEFAULT false;

ADD COLUMN extended_at TIMESTAMP WITH TIME ZONE;

ADD COLUMN extension_days INTEGER; -- Track how many days granted
```

**Rules:**
- ✅ One extension per alumni (60 days)
- ❌ No second extensions
- ✅ Token expires after use
- ✅ Clear messaging about finality

---

### **Purge Process:**

**When 24 months hit:**
```typescript
async function purgeStudentImages(menteeId: string, mentorshipId: string) {
  // 1. Get all images for this mentorship
  const { data: images } = await supabase
    .from('session_images')
    .select('image_url, thumbnail_url')
    .eq('mentorship_id', mentorshipId);
  
  // 2. Delete from Supabase Storage
  for (const img of images) {
    await supabase.storage
      .from('mentorship-images')
      .remove([img.image_url, img.thumbnail_url]);
  }
  
  // 3. Delete database records
  await supabase
    .from('session_images')
    .delete()
    .eq('mentorship_id', mentorshipId);
  
  // 4. Log purge
  await supabase
    .from('image_purge_schedule')
    .update({ 
      status: 'purged',
      purge_executed_at: new Date().toISOString() 
    })
    .eq('mentorship_id', mentorshipId);
  
  console.log(`✅ Purged images for mentorship ${mentorshipId}`);
}
```

---

### **Cancel Purge on Return:**

When alumni renews (webhook):
```typescript
// If they were scheduled for purge, cancel it
await supabase
  .from('image_purge_schedule')
  .update({
    status: 'cancelled',
    cancelled_reason: 'Student renewed mentorship'
  })
  .eq('mentorship_id', mentorship.id)
  .eq('status', 'scheduled');

console.log('Cancelled image purge - student returned!');
```

---

## ⚙️ **Configuration Options**

### **Environment Variables:**

```env
# Image purge settings
IMAGE_PURGE_MONTHS=18           # Delete after 18 months (1.5 years)
IMAGE_PURGE_WARNING_MONTHS=16   # Warn at 16 months (2 months before)
IMAGE_PURGE_ENABLED=true        # Enable/disable purge system
```

**Flexibility:**
- Currently set to 18 months (your choice)
- Can adjust to 12, 24, or any other value
- Can disable entirely if not needed

---

## 📊 **Storage Impact Analysis**

### **With Purge System:**

**Scenario:**
- 10 new students per year
- Each uploads average 50 images (across 4 sessions)
- 50 images × 500KB = 25MB per student

**Without Purge:**
- Year 1: 10 students = 250MB
- Year 2: 20 students = 500MB
- Year 3: 30 students = 750MB
- Year 4: 40 students = 1GB ⚠️ (hitting limit)

**With 18-Month Purge:**
- Year 1: 10 students = 250MB
- Year 2: 20 students = 500MB (Year 1 students still within 18mo)
- Year 3: 25 students = 625MB (5 purged from Year 1)
- Year 4: 25 students = 625MB (10 purged total)
- **Stay around 600-650MB!** ✅

**Benefits:**
- ✅ Stay in free tier indefinitely
- ✅ More aggressive cleanup than 24 months
- ✅ Still very fair (1.5 years is generous)
- ✅ Better storage optimization
- ✅ Only keep images for active + recent alumni
- ✅ Automated with warnings

---

## 🎯 **Admin Dashboard (Phase 2)**

### **Purge Management Page:**

**URL:** `app.huckleberry.art/admin/storage`

**Features:**
```
┌─────────────────────────────────────────┐
│  🗄️ Storage Management                  │
├─────────────────────────────────────────┤
│  📊 Current Usage: 487 MB / 1 GB (49%)  │
│  ━━━━━━━━━━━                   [49%]   │
│                                         │
│  📅 Upcoming Purges (Next 3 Months)     │
│  ┌──────────────────────────────────┐  │
│  │ Feb 15: 3 students (75MB)        │  │
│  │ Mar 1: 2 students (50MB)         │  │
│  │ Mar 20: 1 student (18MB)         │  │
│  └──────────────────────────────────┘  │
│                                         │
│  ⚠️ Warning Emails (Sent This Month)   │
│  • @SarahLee - Sent Nov 1              │
│  • @JohnSmith - Sent Nov 5             │
│                                         │
│  🎯 Actions:                            │
│  [View Purge Schedule] [Cancel Purge]  │
│  [Send Manual Warning] [Adjust Policy] │
└─────────────────────────────────────────┘
```

**Manual Controls:**
- View all scheduled purges
- Cancel purge for specific student (if they request)
- Send warning email early
- Adjust purge timeline

---

## 🔔 **Notification Timeline**

```
Month 0:  Student completes mentorship, ends subscription
          ↓
Month 16: Warning email #1 sent ⚠️
          "Your images will be deleted in 2 months"
          [Download Archive] + [Extend 60 Days] buttons
          ↓
Month 17: Reminder email sent ⚠️
          "Last chance! Delete in 1 month"
          [Download Archive] + [Extend 60 Days] buttons
          ↓
Month 18: Images purged 🗑️
          OR
          Extension granted → New deadline: Month 20
          ↓
Month 20: (If extended) Images purged 🗑️
          Storage freed
          Admin notified of purge completion

───── OR ─────

Student Returns (anytime) → Purge cancelled, images kept ✅
```

**Grace Period:** 2 months of warnings + optional 60-day extension  
**Total Retention:** 18 months base, up to 20 months with extension

---

## 📧 **Second Warning Email (1 Month Before)**

**Subject:** Last Chance: Download Your Images (Purge in 30 Days)

**Body:**
```html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #dc3545;">⏰ Final Reminder</h1>
  
  <p>Hi [Name],</p>
  
  <p>We sent you a reminder last month, but wanted to make sure you saw it!</p>
  
  <p>Your <strong>[X] images</strong> from your mentorship will be 
  <strong style="color: #dc3545;">permanently deleted on [Date]</strong> 
  (in 30 days).</p>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="https://app.huckleberry.art/download-archive/[token]" 
       style="display: inline-block; padding: 15px 32px; background-color: #dc3545; 
              color: white; text-decoration: none; border-radius: 5px; 
              font-size: 16px; font-weight: bold;">
      Download My Images Now
    </a>
  </div>
  
  <div style="background-color: #f0f7ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0; font-size: 14px;">
      <strong>Need 60 more days?</strong>
    </p>
    <p style="margin: 10px 0 0 0; font-size: 14px;">
      One-time extension available:
    </p>
    <div style="text-align: center; margin: 15px 0 0 0;">
      <a href="https://app.huckleberry.art/extend-retention/[token]" 
         style="display: inline-block; padding: 10px 24px; background-color: #28a745; 
                color: white; text-decoration: none; border-radius: 5px; 
                font-size: 14px; font-weight: bold;">
        Extend by 60 Days
      </a>
    </div>
    <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">
      (Must download before extension expires - no further extensions available)
    </p>
  </div>
  
  <p style="font-size: 13px; color: #666;">
    This is your final chance to save your work!
  </p>
</div>
```

---

## 🛡️ **Safety Features**

### **Prevent Accidental Purges:**

1. **Multiple Warnings:** 2 months, then 1 month before
2. **Easy Download:** One-click ZIP archive
3. **Cancel on Return:** If they renew, purge cancelled automatically
4. **Admin Override:** Can cancel purge manually
5. **Purge Log:** Track what was deleted when (for support requests)

### **What If Student Requests Extension?**

**Before Purge (Student Asks for More Time):**
- Can manually cancel purge for them
- Extend retention period if needed
- **Inform them:** "Renewing your mentorship resets the retention period to 18 months from when you next complete!"
- This gently suggests renewal without being pushy
- Student decides: extend once, or renew and keep images while active

**Response Template (If They Contact Support):**
```
Hi [Name]!

You can extend your image retention by 60 days using the link below:

[Extend Retention by 60 Days]

This is a one-time extension. Please make sure to download your images 
before the new deadline, as we can't extend beyond that.

Just FYI: If you ever decide to renew your mentorship, your images 
would be kept for as long as you remain an active student. When you 
complete your next round of sessions, the 18-month retention period 
would start over from that point.

Let me know if you have any questions!
```

**Better Approach - Add to Warning Emails:**
Include extension button directly in warning emails (no support contact needed!)

**After Purge (Student Asks to Restore):**
- Images are gone (can't restore - be clear about this)
- Session notes and text are preserved ✅
- Explain 18-month policy with 2-month warnings
- If they renew: fresh start with new images

---

## 📊 **Purge Analytics**

Track storage savings:

```sql
-- Storage freed over time
SELECT 
  DATE_TRUNC('month', purge_executed_at) AS month,
  SUM(storage_size_mb) AS mb_freed,
  COUNT(*) AS students_purged
FROM image_purge_schedule
WHERE status = 'purged'
GROUP BY DATE_TRUNC('month', purge_executed_at)
ORDER BY month DESC;
```

---

## 🎯 **Retention Settings**

### **Option A: 24 Months (Generous)**
- **Pros:** Very fair to students, plenty of time to return
- **Cons:** More storage usage
- **Best for:** You have storage headroom

### **Option B: 18 Months (Balanced) ✅ CHOSEN**
- **Pros:** Still generous, saves more storage
- **Cons:** Less time for long-term returns
- **Best for:** Moderate storage concerns
- **Why Chosen:** Balances fairness with storage efficiency

### **Option C: 12 Months (Aggressive)**
- **Pros:** Maximum storage savings
- **Cons:** May feel short to some users
- **Best for:** Limited storage budget

**Your Choice:** **18 months** - Fair to students while optimizing storage costs

---

## 🔄 **Complete Lifecycle**

```
Active Student → Images kept while active
     ↓
Mentorship Ends → Keep images (alumni status)
     ↓
16 months → Warning email #1 with [Extend 60 Days] button
     ↓
17 months → Warning email #2 with [Extend 60 Days] button
     ↓
18 months → Images purged OR Extension granted
     ↓           ↓
Storage      20 months → Images purged
freed!                → Storage freed

───── OR (ANYTIME) ─────

Student Renews Mentorship → Purge cancelled, images kept ✅
                          → Retention clock resets
```

**Timeline:** 
- Base: 18 months (1.5 years)
- With extension: 20 months (1.67 years)
- Extension: One-time, 60 days

---

## ✅ **Implementation Checklist**

### **Phase 2 (Web Interface):**
- [ ] Build download archive feature (ZIP with all images + notes)
- [ ] Build 60-day extension feature (one-click, one-time)
- [ ] Create purge management dashboard
- [ ] Implement warning email templates (with extension button)
- [ ] Build purge execution logic
- [ ] Build confirmation page for extensions

### **Phase 3 (Automation):**
- [ ] Set up monthly cron job (Supabase Function or GitHub Actions)
- [ ] Automated warning emails (16 months)
- [ ] Automated reminder emails (17 months)
- [ ] Automated purge execution (18 months)
- [ ] Admin notification after purges

### **Configuration:**
- [ ] Add purge settings to environment variables (18 months chosen)
- [ ] Set IMAGE_PURGE_MONTHS=18, IMAGE_PURGE_WARNING_MONTHS=16
- [ ] Test with dummy data

---

## 💡 **Benefits**

### **For Your Business:**
- ✅ Stay within free storage tier forever
- ✅ Predictable, manageable storage costs
- ✅ Professional data retention policy
- ✅ Automated (minimal manual work)

### **For Students:**
- ✅ 18 months of free storage (very generous)
- ✅ Multiple warnings before deletion (2 months notice)
- ✅ One-time 60-day extension (self-service, no support needed)
- ✅ Easy one-click download
- ✅ Fair and transparent policy
- ✅ Clear deadlines and options

### **For Active Students:**
- ✅ Never affected (images kept while active)
- ✅ No storage worries during mentorship
- ✅ Encourages staying active

---

## 📝 **Purge Policy (User-Facing)**

Add to your terms/FAQ:

> **Image Storage Policy**
> 
> - **Active students:** Your images are stored securely for the duration of your active mentorship
> - **Past students:** Images are kept for 18 months after your mentorship ends
> - **Warnings:** We'll email you 2 months before deletion (at 16 months)
> - **Download:** One-click archive download of all your images
> - **Renewals:** If you renew your mentorship, the 18-month retention period resets (images kept while active, then 18 months after you complete)
>
> This policy allows us to provide free image hosting while maintaining a sustainable service.

---

**Added to Phase 2 plan!** This ensures your storage stays manageable while being very fair to students. 🎯

Want me to commit this updated plan? 🚀

---

## 🚀 **Deployment Plan**

### **Vercel Deployment**
1. Connect GitHub/GitLab repo to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy automatically on git push
4. Custom domain: `app.huckleberry.art` or `portal.huckleberry.art`

### **Environment Variables**
```env
# Discord OAuth
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_REDIRECT_URI=https://app.huckleberry.art/api/auth/callback/discord

# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# NextAuth
NEXTAUTH_URL=https://app.huckleberry.art
NEXTAUTH_SECRET=... # generate with: openssl rand -base64 32

# Admin
ADMIN_DISCORD_ID=...
```

---

## 📝 **Next Steps When Ready to Start**

### **Day 1 Setup Checklist:**
1. [ ] Create new Next.js project
2. [ ] Install dependencies
3. [ ] Set up Supabase client
4. [ ] Configure Discord OAuth in Discord Developer Portal
5. [ ] Add OAuth redirect URL: `http://localhost:3000/api/auth/callback/discord`
6. [ ] Create `.env.local` with all variables
7. [ ] Run database migrations for new tables
8. [ ] Start development server and test login

### **Resources to Bookmark:**
- Next.js Docs: https://nextjs.org/docs
- Supabase Storage: https://supabase.com/docs/guides/storage
- NextAuth.js Discord Provider: https://next-auth.js.org/providers/discord
- shadcn/ui: https://ui.shadcn.com/
- browser-image-compression: https://github.com/Donaldcwl/browser-image-compression

---

## 🎯 **Success Metrics**

### **MVP Success = When You Can:**
- ✅ Login with Discord
- ✅ See your session notes from Discord bot
- ✅ Upload an image to a session
- ✅ View uploaded images in a gallery
- ✅ Instructors can switch between students
- ✅ Works on mobile

### **Full Success = When You Have:**
- ✅ All of MVP
- ✅ Rich text notes
- ✅ Image comments/feedback
- ✅ Progress tracking
- ✅ Portfolio view
- ✅ Search functionality

---

## 💡 **Nice-to-Have Features (Future)**

- Real-time collaboration (multiple users viewing same session)
- Drawing annotations on images (like Figma comments)
- Video uploads and playback
- Assignment system (instructor assigns homework)
- Calendar integration for scheduling
- Push notifications for new feedback
- Mobile app (React Native)
- AI-powered feedback suggestions
- Export session history as PDF report

---

## 🤔 **Open Questions to Decide Later**

1. Should Discord bot post a link when image is uploaded via web?
2. Should web notes sync back to Discord as DMs?
3. Do we want email notifications for new uploads?
4. Should students be able to tag instructors in comments?
5. Public portfolio URLs (shareable with employers)?

---

## 📞 **Support & Resources**

When you're ready to start:
- I'll help scaffold the initial project structure
- We'll set up the database migrations together
- I'll guide you through Discord OAuth setup
- We can build the image uploader component step-by-step

---

**Status:** Ready to implement when you are! 🚀

**Last Updated:** November 16, 2025  
**Next Review:** When you're ready to start Phase 2

---

**This is an exciting next chapter for your mentorship platform!** The web interface will make the experience so much richer for students and instructors. Take your time to rest, and we'll dive in when you're ready! 🎨✨

