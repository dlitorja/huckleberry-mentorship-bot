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

#### **Search & Filter**
- [ ] Search across notes and image captions
- [ ] Filter by date range
- [ ] Filter by tags
- [ ] Quick search in navbar

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

**Last Updated:** November 9, 2025  
**Next Review:** When you're ready to start Phase 2

---

**This is an exciting next chapter for your mentorship platform!** The web interface will make the experience so much richer for students and instructors. Take your time to rest, and we'll dive in when you're ready! 🎨✨

