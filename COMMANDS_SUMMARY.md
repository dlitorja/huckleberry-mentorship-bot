# Discord Commands Summary

Complete list of all bot commands organized by user type.

## 👨‍🏫 Instructor Commands

### Session Management
- **`/session`** - Mark a session as completed, decrement count, record date
  - Optional: Backdate sessions
- **`/addsessions`** - Add sessions to a student's account
- **`/liststudents`** - View all your students with session counts and last session dates
- **`/sessionsummary`** - Show a student's remaining sessions (public message)

### Session Notes (NEW!)
- **`/addnote`** - Add text notes for a session
- **`/addlink`** - Add resource links to a session  
- **`/viewnotes`** - View session notes and links for a student

---

## 👤 Student Commands

### View Your Progress
- **`/viewnotes`** - View your own session notes and links (use your own @mention)

---

## 🔐 Admin Commands (You Only)

### Monitoring
- **`/adminsummary`** - View all mentorships across all instructors
- **`/checkpending`** - View students who purchased but haven't joined Discord
- **`/dailysummary`** - Daily/weekly statistics (purchases, joins, rates)
- **`/alertdelayed`** - Get DM alerts for students who haven't joined after X hours

### Manual Management
- **`/linkstudent`** - Manually link a student's email to their Discord account
- **`/removestudent`** - Remove a student's 1-on-1 Mentee role (NEW!)
- **`/viewnotes`** - View notes for any student (admin override)

---

## 📋 Command Details

### `/session student:@Name [date:YYYY-MM-DD]`
**What it does:**
- Decrements session count by 1
- Records session date (today or specified date)
- Shows remaining sessions and last session date

**Examples:**
```
/session student:@JohnDoe
/session student:@JohnDoe date:2025-11-05
/session student:@JohnDoe date:11/05/2025
```

---

### `/addnote student:@Name notes:Text [date:YYYY-MM-DD]`
**What it does:**
- Adds text notes for a session
- Updates existing note if one exists for that date
- Links to mentorship record

**Examples:**
```
/addnote student:@JohnDoe notes:Covered composition basics. Student improved lighting significantly.

/addnote student:@JohnDoe date:11/05/2025 notes:Review session before final project.
```

---

### `/addlink student:@Name url:URL [title:Text] [date:YYYY-MM-DD]`
**What it does:**
- Adds a resource link to a session
- Multiple links per session allowed
- Auto-creates session note if needed

**Examples:**
```
/addlink student:@JohnDoe url:https://youtube.com/watch?v=abc title:Portrait Lighting Tutorial

/addlink student:@JohnDoe url:https://example.com/reference
```

---

### `/viewnotes student:@Name [limit:5]`
**What it does:**
- Shows session notes in a nice embed
- Includes all links for each session
- Most recent sessions first

**Permissions:**
- Instructors: View their own students
- Students: View their own notes only
- Admin: View anyone's notes

**Examples:**
```
/viewnotes student:@JohnDoe
/viewnotes student:@JohnDoe limit:10
```

---

### `/liststudents`
**What it shows (NEW format):**
```
@Student1 – 3/4 sessions | Last: Nov 9, 2025
@Student2 – 1/4 sessions | Last: Oct 15, 2025
@Student3 – 4/4 sessions | Last: No sessions yet
```

---

### `/sessionsummary student:@Name`
**What it shows (NEW format):**
```
@Student – 3/4 sessions remaining.
📅 Last session: Nov 9, 2025
```

---

### `/adminsummary`
**What it shows (NEW format):**
```
📊 Mentorship Summary (All Instructors)

Instructor: @InstructorName
  └ @Student1: 3/4 sessions | Last: Nov 9
  └ @Student2: 1/4 sessions | Last: Oct 15

Instructor: @AnotherInstructor
  └ @Student3: 2/4 sessions | Last: Nov 1
```

---

### `/checkpending`
**What it shows:**
- List of all students who purchased but haven't joined Discord
- How long ago they purchased
- Which instructor they're assigned to
- Warning for joins older than 24 hours

---

### `/dailysummary [days:1]`
**What it shows:**
- Total purchases in time period
- Successful joins vs pending
- Join rate percentage
- Breakdown by instructor
- Recent activity feed

---

### `/alertdelayed [hours:24]`
**What it does:**
- Finds students who haven't joined after X hours
- Sends you a DM for each one with details
- Suggests following up with the student

---

### `/linkstudent email:Email discorduser:@Name`
**What it does:**
- Manually links a purchase to a Discord account
- Assigns "1-on-1 Mentee" role
- Creates mentorship record with 4 sessions
- Sends welcome DMs
- For when OAuth doesn't work or customer is already in Discord

**Example:**
```
/linkstudent email:customer@example.com discorduser:@JohnDoe
```

---

### `/removestudent student:@Name [reason:Text] [send_goodbye:true/false]`
**What it does:**
- Removes the "1-on-1 Mentee" role from a student
- Updates mentorship status to "ended" in database
- Optionally sends goodbye DM to student
- Notifies admin (you) with details
- Preserves mentorship history for analytics

**Options:**
- `student` (required): The Discord user to remove
- `reason` (optional): Why the role is being removed (default: "Mentorship ended")
- `send_goodbye` (optional): Send goodbye DM? (default: true)

**Use Cases:**
- Manual cancellations/refunds (though Kajabi webhooks handle this automatically)
- Students who completed their program
- Policy violations or other admin actions
- Testing removal flow

**Examples:**
```
/removestudent student:@JohnDoe

/removestudent student:@JaneDoe reason:"Completed mentorship program"

/removestudent student:@BobSmith reason:"Refund processed manually" send_goodbye:false
```

**Note:** For automatic removal on Kajabi cancellations/refunds, see [STUDENT_REMOVAL.md](STUDENT_REMOVAL.md)

---

## 🎯 Typical Workflows

### **After a Session:**
```
1. /session student:@JohnDoe
2. /addnote student:@JohnDoe notes:What we covered...
3. /addlink student:@JohnDoe url:https://tutorial.com
```

### **Before Next Session:**
```
1. /viewnotes student:@JohnDoe
   → Review what was covered last time
2. Prepare for next session
```

### **Student Self-Review:**
```
Student runs: /viewnotes student:@themselves
→ Reviews notes and studies linked resources
```

### **Weekly Admin Check:**
```
1. /dailysummary days:7
2. /checkpending
3. /adminsummary
```

---

## 📱 **Phase 2: Web Interface (Future)**

When built, will add:
- 🖼️ Image uploads (with auto-compression)
- ✏️ Rich text editing
- 🔍 Search across all notes
- 📊 Progress visualization
- 📥 Export notes as PDF
- 📱 Mobile-responsive design

**All Discord notes will sync to web automatically!**

---

## 🎉 **Total Commands: 13**

- 4 for session management
- 3 for session notes
- 6 for admin monitoring and management (including removestudent!)

Your mentorship bot is now a complete platform! 🚀

