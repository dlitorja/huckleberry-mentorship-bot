"use client";
import { useEffect, useState, useMemo } from "react";
import {
  Combobox,
  ComboboxAnchor,
  ComboboxCancel,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { TimezoneSelector } from "@/components/ui/timezone-selector";
import { cn } from "@/lib/utils";
import { Pencil, X, Check } from "lucide-react";

type Mentorship = {
  id: string;
  sessions_remaining: number | null;
  mentees: { 
    discord_id: string | null; 
    email: string | null; 
    discord_username?: string | null;
    display_name?: string | null;
    id?: string; // Add mentee ID for API calls
  } | null;
};

type InstructorWithMentees = {
  instructor: {
    id: string;
    name: string | null;
    discord_id: string | null;
    discord_username?: string | null; // Optional, instructors table doesn't have this
  };
  mentorships: Mentorship[];
};

export default function InstructorDashboardPage() {
  const [mentorships, setMentorships] = useState<Mentorship[]>([]);
  const [instructors, setInstructors] = useState<InstructorWithMentees[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<Record<string, { date: string; time: string }>>({});
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [instructorTimezone, setInstructorTimezone] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Load timezone from localStorage or detect
  useEffect(() => {
    const stored = localStorage.getItem("instructor_timezone");
    if (stored) {
      setInstructorTimezone(stored);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/instructor/mentorships", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || `Failed to load mentorships (${res.status})`);
          setLoading(false);
          return;
        }
        if (data.isAdmin) {
          setIsAdmin(true);
          setInstructors(data.instructors || []);
          // Flatten all mentorships for filtering - ensure we have all mentorships
          const allMentorships = (data.instructors || []).flatMap((inst: InstructorWithMentees) => inst.mentorships || []);
          setMentorships(allMentorships);
          console.log('[Admin] Loaded instructors:', data.instructors?.length, 'Total mentorships:', allMentorships.length);
        } else {
          setIsAdmin(false);
          setMentorships(data.mentorships || []);
        }
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load mentorships");
        setLoading(false);
      }
    })();
  }, []);

  async function adjustSessions(mentorshipId: string, delta: number) {
    const res = await fetch("/api/instructor/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "incdec", mentorshipId, delta })
    });
    if (res.ok) {
      const data = await res.json();
      // Update both mentorships and instructors arrays to keep them in sync
      setMentorships((prev) =>
        prev.map((m) => (m.id === mentorshipId ? { ...m, sessions_remaining: data.sessions_remaining } : m))
      );
      if (isAdmin) {
        setInstructors((prev) =>
          prev.map((inst) => ({
            ...inst,
            mentorships: inst.mentorships.map((m) =>
              m.id === mentorshipId ? { ...m, sessions_remaining: data.sessions_remaining } : m
            ),
          }))
        );
      }
    }
  }

  async function scheduleSession(m: Mentorship) {
    const values = schedule[m.id];
    if (!values?.date || !values?.time) return;
    
    // If instructor timezone is set, use it; otherwise use browser's timezone
    const tz = instructorTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const localDateTime = `${values.date}T${values.time}`;
    const scheduledAtUtc = convertLocalToUTC(localDateTime, tz);
    // Server derives instructor/mentee ids from mentorship
    const res = await fetch("/api/instructor/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "schedule",
        mentorshipId: m.id,
        scheduledAtUtc,
        durationMinutes: 60 // All sessions are 60 minutes
      })
    });
    if (!res.ok) return;
    const data = await res.json();
    const fireAt = new Date(new Date(scheduledAtUtc).getTime() - 10 * 60 * 1000).toISOString();
    await fetch("/api/notifications/enqueue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scheduled_session_id: data.scheduled_session_id,
        mentorship_id: m.id,
        mentee_discord_id: m.mentees?.discord_id || "",
        instructor_discord_id: "",
        fire_at_utc: fireAt
      })
    });
    // Clear the schedule form after successful scheduling
    setSchedule((s) => {
      const updated = { ...s };
      delete updated[m.id];
      return updated;
    });
  }

  async function logSession(mentorshipId: string) {
    await adjustSessions(mentorshipId, -1);
  }

  function handleDisplayNameUpdate(mentorshipId: string, displayName: string | null) {
    console.log('[Debug] Updating display name for mentorship:', mentorshipId, 'to:', displayName);
    // Update mentorships state
    setMentorships((prev) => {
      const updated = prev.map((m) =>
        m.id === mentorshipId && m.mentees
          ? { ...m, mentees: { ...m.mentees, display_name: displayName } }
          : m
      );
      console.log('[Debug] Updated mentorships state');
      return updated;
    });
    // Update instructors state for admin view
    if (isAdmin) {
      setInstructors((prev) => {
        const updated = prev.map((inst) => ({
          ...inst,
          mentorships: inst.mentorships.map((m) =>
            m.id === mentorshipId && m.mentees
              ? { ...m, mentees: { ...m.mentees, display_name: displayName } }
              : m
          ),
        }));
        console.log('[Debug] Updated instructors state');
        return updated;
      });
    }
  }

  // Helper function to convert local date/time in a specific timezone to UTC
  function convertLocalToUTC(localDateTime: string, timezone: string): string {
    // localDateTime format: "YYYY-MM-DDTHH:mm"
    const [datePart, timePart] = localDateTime.split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hours, minutes] = timePart.split(":").map(Number);
    
    // Simple and reliable method: 
    // 1. Create a date string in ISO format (treating it as local time in the timezone)
    // 2. Use Intl to format a UTC date in the target timezone
    // 3. Find the UTC date that produces our desired local time
    
    // Start with a reasonable guess: assume the local time is close to UTC
    let guess = new Date(Date.UTC(year, month - 1, day, hours, minutes));
    
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    
    // Refine the guess by checking what the UTC time looks like in the target timezone
    for (let i = 0; i < 5; i++) {
      const parts = formatter.formatToParts(guess);
      const tzYear = parseInt(parts.find(p => p.type === "year")?.value || "0");
      const tzMonth = parseInt(parts.find(p => p.type === "month")?.value || "0");
      const tzDay = parseInt(parts.find(p => p.type === "day")?.value || "0");
      const tzHour = parseInt(parts.find(p => p.type === "hour")?.value || "0");
      const tzMinute = parseInt(parts.find(p => p.type === "minute")?.value || "0");
      
      if (tzYear === year && tzMonth === month && tzDay === day && tzHour === hours && tzMinute === minutes) {
        return guess.toISOString();
      }
      
      // Calculate offset: how much to adjust
      const targetTime = new Date(Date.UTC(year, month - 1, day, hours, minutes));
      const tzTime = new Date(Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute));
      const offset = targetTime.getTime() - tzTime.getTime();
      guess = new Date(guess.getTime() - offset);
    }
    
    return guess.toISOString();
  }

  // All hooks must be called before any early returns - always call them unconditionally
  const filteredMentorships = useMemo(() => {
    if (!selectedStudent) return mentorships;
    return mentorships.filter((m) => m.id === selectedStudent);
  }, [mentorships, selectedStudent]);

  // Get all available mentorships (unfiltered)
  const allAvailableMentorships = useMemo(() => {
    if (isAdmin && instructors.length > 0) {
      const allMentorships = instructors.flatMap((inst) => inst.mentorships || []);
      const uniqueMentorships = new Map<string, Mentorship>();
      allMentorships.forEach((m) => {
        if (!uniqueMentorships.has(m.id)) {
          uniqueMentorships.set(m.id, m);
        }
      });
      return Array.from(uniqueMentorships.values());
    }
    return mentorships || [];
  }, [mentorships, isAdmin, instructors]);

  const studentOptions = useMemo(() => {
    if (allAvailableMentorships.length === 0) return [];
    
    // Build options with searchable text
    const allOptions: Array<{ value: string; label: string; searchText: string }> = 
      allAvailableMentorships.map((m) => {
        // Priority: display_name > Discord username > Full Discord ID > Email (last resort)
        let menteeName: string;
        if (m.mentees?.display_name) {
          menteeName = m.mentees.display_name;
        } else if (m.mentees?.discord_username) {
          // Ensure Discord username has @ prefix if it doesn't already
          menteeName = m.mentees.discord_username.startsWith("@") 
            ? m.mentees.discord_username 
            : `@${m.mentees.discord_username}`;
        } else if (m.mentees?.discord_id) {
          // Show full Discord ID, not just last 4 digits
          menteeName = m.mentees.discord_id;
        } else if (m.mentees?.email) {
          // Email as last resort - show just the username part before @
          const emailParts = m.mentees.email.split("@");
          menteeName = emailParts[0] || m.mentees.email;
        } else {
          menteeName = "Unknown Student";
        }
        
        // Create searchable text that includes all possible search terms (including display_name)
        // Make sure to include the display_name even if it's being used as the label
        const searchText = [
          m.mentees?.display_name || "",
          m.mentees?.discord_username || "",
          m.mentees?.email || "",
          m.mentees?.discord_id || "",
          menteeName, // Also include the computed display name for search
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        
        return {
          value: m.id,
          label: menteeName,
          searchText,
        };
      });
    
    // Filter by search query if provided
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      return allOptions.filter((opt) => opt.searchText.includes(query));
    }
    
    return allOptions;
  }, [allAvailableMentorships, searchQuery]);
  
  // Debug: Log when studentOptions changes
  useEffect(() => {
    console.log('[Debug] studentOptions updated:', studentOptions.length, 'options');
    if (studentOptions.length > 0) {
      console.log('[Debug] First option:', studentOptions[0]);
    }
  }, [studentOptions]);

  // For admin view: group by instructor
  const displayData = useMemo(() => {
    if (!isAdmin) {
      return { instructors: null, mentorships: filteredMentorships || [] };
    }
    
    // Filter instructors based on selected student
    // For admins: always show instructors that have the selected student's mentorship
    const filteredInstructors = (instructors || [])
      .map((inst) => ({
        ...inst,
        mentorships: selectedStudent
          ? (inst.mentorships || []).filter((m) => m.id === selectedStudent)
          : (inst.mentorships || []),
      }))
      .filter((inst) => {
        // If a student is selected, only show instructors that have that student
        // If no student is selected, show all instructors
        if (selectedStudent) {
          return (inst.mentorships || []).length > 0;
        }
        return (inst.mentorships || []).length > 0;
      });
    
    return { instructors: filteredInstructors, mentorships: null };
  }, [isAdmin, instructors, selectedStudent, filteredMentorships]);

  // Early returns after all hooks
  if (loading) return <p>Loading...</p>;
  if (error) return (
    <div className="p-4 rounded-md border bg-white dark:bg-neutral-950 dark:border-neutral-900">
      <div className="font-medium text-red-600">Error loading mentorships</div>
      <p className="text-sm text-gray-600 dark:text-neutral-400 mt-1">{error}</p>
      <p className="text-sm text-gray-600 dark:text-neutral-400">Make sure your account is an instructor and that Supabase envs are set.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          {isAdmin ? "Admin Dashboard" : "Instructor Dashboard"}
        </h1>
        {allAvailableMentorships.length > 0 && (
          <Combobox
            value={selectedStudent || ""}
            onValueChange={(value: string | string[]) => {
              const stringValue = Array.isArray(value) ? value[0] || "" : value;
              setSelectedStudent(stringValue || null);
              setSearchQuery(""); // Clear search when selected
            }}
          >
            <ComboboxAnchor>
              <ComboboxInput 
                placeholder="Search students..." 
                value={searchQuery}
                onChange={(e) => {
                  const newQuery = e.target.value;
                  setSearchQuery(newQuery);
                  // Clear selection when searching
                  if (selectedStudent && newQuery !== "") {
                    setSelectedStudent(null);
                  }
                }}
              />
              {selectedStudent && (
                <ComboboxCancel 
                  onClick={() => {
                    setSelectedStudent(null);
                    setSearchQuery("");
                  }} 
                />
              )}
              <ComboboxTrigger />
            </ComboboxAnchor>
            <ComboboxContent>
              <ComboboxEmpty>No students found</ComboboxEmpty>
              {studentOptions.map((option) => (
                <ComboboxItem key={option.value} value={option.value}>
                  {option.label}
                </ComboboxItem>
              ))}
            </ComboboxContent>
          </Combobox>
        )}
      </div>
      
      {/* Admin view: Grouped by instructor */}
      {isAdmin && displayData.instructors && (
        <div className="space-y-6">
          {displayData.instructors.map((instGroup) => (
            <div key={instGroup.instructor.id} className="space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-neutral-800">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {instGroup.instructor.name || `Instructor ${instGroup.instructor.discord_id?.slice(-4) || ""}` || "Unknown Instructor"}
                </h2>
                <span className="text-sm text-gray-600 dark:text-neutral-400">
                  ({instGroup.mentorships.length} {instGroup.mentorships.length === 1 ? "mentee" : "mentees"})
                </span>
                {instGroup.instructor.discord_id && (
                  <span className="text-xs text-gray-500 dark:text-neutral-500">
                    Discord ID: {instGroup.instructor.discord_id}
                  </span>
                )}
              </div>
              <div className="grid gap-4 ml-4">
                {instGroup.mentorships.map((m) => (
                  <MentorshipCard key={m.id} m={m} schedule={schedule} setSchedule={setSchedule} adjustSessions={adjustSessions} scheduleSession={scheduleSession} logSession={logSession} isAdmin={true} instructorTimezone={instructorTimezone} setInstructorTimezone={setInstructorTimezone} onDisplayNameUpdate={handleDisplayNameUpdate} />
                ))}
              </div>
            </div>
          ))}
          {displayData.instructors.length === 0 && (
            <div className="p-4 rounded-md border border-gray-200 dark:border-neutral-900 bg-white dark:bg-neutral-950">
              <div className="font-medium text-gray-900 dark:text-white">No instructors with active mentees</div>
              <p className="text-sm text-gray-600 dark:text-neutral-400 mt-1">
                {selectedStudent 
                  ? `No instructors found for the selected student. Selected: ${selectedStudent}` 
                  : "No active mentorships found."}
              </p>
            </div>
          )}
        </div>
      )}
      
      {/* Instructor view: Flat list */}
      {!isAdmin && (
        <div className="grid gap-4">
                  {displayData.mentorships?.map((m) => (
                    <MentorshipCard key={m.id} m={m} schedule={schedule} setSchedule={setSchedule} adjustSessions={adjustSessions} scheduleSession={scheduleSession} logSession={logSession} isAdmin={false} instructorTimezone={instructorTimezone} setInstructorTimezone={setInstructorTimezone} onDisplayNameUpdate={handleDisplayNameUpdate} />
                  ))}
          {displayData.mentorships?.length === 0 && mentorships.length > 0 && (
            <div className="p-4 rounded-md border border-gray-200 dark:border-neutral-900 bg-white dark:bg-neutral-950">
              <div className="font-medium text-gray-900 dark:text-white">No students match your filter</div>
              <p className="text-sm text-gray-600 dark:text-neutral-400 mt-1">
                Try selecting a different student or clearing the filter.
              </p>
            </div>
          )}
          {mentorships.length === 0 && (
            <div className="p-4 rounded-md border border-gray-200 dark:border-neutral-900 bg-white dark:bg-neutral-950">
              <div className="font-medium text-gray-900 dark:text-white">No active mentees</div>
              <p className="text-sm text-gray-600 dark:text-neutral-400 mt-1">
                When students are linked to you, they will show here with remaining sessions.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Extracted mentorship card component for reuse
function MentorshipCard({
  m,
  schedule,
  setSchedule,
  adjustSessions,
  scheduleSession,
  logSession,
  isAdmin,
  instructorTimezone,
  setInstructorTimezone,
  onDisplayNameUpdate,
}: {
  m: Mentorship;
  schedule: Record<string, { date: string; time: string }>;
  setSchedule: React.Dispatch<React.SetStateAction<Record<string, { date: string; time: string }>>>;
  adjustSessions: (mentorshipId: string, delta: number) => Promise<void>;
  scheduleSession: (m: Mentorship) => Promise<void>;
  logSession: (mentorshipId: string) => Promise<void>;
  isAdmin: boolean;
  instructorTimezone: string;
  setInstructorTimezone: (tz: string) => void;
  onDisplayNameUpdate?: (mentorshipId: string, displayName: string | null) => void;
}) {
  // Get mentee display name - Priority: display_name > Discord username > Full Discord ID > Email (last resort)
  let menteeName: string;
  if (m.mentees?.display_name) {
    menteeName = m.mentees.display_name;
  } else if (m.mentees?.discord_username) {
    // Ensure Discord username has @ prefix if it doesn't already
    menteeName = m.mentees.discord_username.startsWith("@") 
      ? m.mentees.discord_username 
      : `@${m.mentees.discord_username}`;
  } else if (m.mentees?.discord_id) {
    // Show full Discord ID, not just last 4 digits
    menteeName = m.mentees.discord_id;
  } else if (m.mentees?.email) {
    // Email as last resort - show just the username part before @
    const emailParts = m.mentees.email.split("@");
    menteeName = emailParts[0] || m.mentees.email;
  } else {
    menteeName = "Unknown Student";
  }
  
  const sessionsRemaining = m.sessions_remaining ?? 0;
  const [isEditingDisplayName, setIsEditingDisplayName] = useState(false);
  const [displayNameValue, setDisplayNameValue] = useState(m.mentees?.display_name || "");
  const [isSavingDisplayName, setIsSavingDisplayName] = useState(false);

  async function saveDisplayName() {
    if (!m.mentees?.id) return;
    
    setIsSavingDisplayName(true);
    try {
      const res = await fetch("/api/instructor/mentees/display-name", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menteeId: m.mentees.id,
          displayName: displayNameValue.trim() || null,
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        // Update the local state
        if (m.mentees) {
          m.mentees.display_name = data.display_name;
        }
        setIsEditingDisplayName(false);
        // Notify parent to refresh data
        if (onDisplayNameUpdate) {
          onDisplayNameUpdate(m.id, data.display_name);
        }
      }
    } catch (err) {
      console.error("Failed to save display name:", err);
    } finally {
      setIsSavingDisplayName(false);
    }
  }

  function cancelEditDisplayName() {
    setDisplayNameValue(m.mentees?.display_name || "");
    setIsEditingDisplayName(false);
  }

  return (
    <div key={m.id} className="p-6 border border-gray-200 dark:border-neutral-900 rounded-lg bg-white dark:bg-neutral-950 shadow-sm">
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1">
          {/* Mentee Display Name - Prominent and Above Sessions */}
          <div className="text-center mb-4">
            {isEditingDisplayName ? (
              <div className="flex items-center justify-center gap-2 mb-2">
                <input
                  type="text"
                  value={displayNameValue}
                  onChange={(e) => setDisplayNameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      saveDisplayName();
                    } else if (e.key === "Escape") {
                      cancelEditDisplayName();
                    }
                  }}
                  className="text-3xl font-bold text-center bg-transparent border-b-2 border-indigo-500 dark:border-indigo-400 text-gray-900 dark:text-white focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-500 max-w-md"
                  placeholder="Enter display name..."
                  autoFocus
                  maxLength={100}
                />
                <button
                  onClick={saveDisplayName}
                  disabled={isSavingDisplayName}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-neutral-800 text-green-600 dark:text-green-400 disabled:opacity-50"
                  title="Save"
                >
                  <Check size={20} />
                </button>
                <button
                  onClick={cancelEditDisplayName}
                  disabled={isSavingDisplayName}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-neutral-800 text-red-600 dark:text-red-400 disabled:opacity-50"
                  title="Cancel"
                >
                  <X size={20} />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {menteeName}
                </div>
                <button
                  onClick={() => setIsEditingDisplayName(true)}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200"
                  title="Edit display name"
                >
                  <Pencil size={18} />
                </button>
              </div>
            )}
            {/* Show additional info only for admins */}
            {isAdmin && (
              <div className="text-sm text-gray-600 dark:text-neutral-400">
                {m.mentees?.discord_id ? `Discord ID: ${m.mentees.discord_id}` : "No Discord ID"}
                {m.mentees?.email && ` • ${m.mentees.email}`}
              </div>
            )}
          </div>
          {/* Sessions Remaining - Centered and Prominent, Below Username */}
          <div className="text-center mb-6">
            <div className={cn(
              "text-2xl font-bold",
              sessionsRemaining === 0 
                ? "text-red-600 dark:text-red-400" 
                : "text-gray-900 dark:text-white"
            )}>
              {sessionsRemaining} {sessionsRemaining === 1 ? "mentorship session" : "mentorship sessions"} remaining
            </div>
          </div>
        </div>
      </div>

      {/* Primary Action: Log Session */}
      <div className="mb-4">
        <button
          onClick={() => logSession(m.id)}
          disabled={sessionsRemaining === 0}
          className="w-full px-4 py-3 rounded-md bg-indigo-600 dark:bg-indigo-500 text-white font-medium hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-600 dark:disabled:hover:bg-indigo-500"
        >
          Log a mentorship session with {menteeName}
        </button>
      </div>

      {/* Secondary Action: Add Sessions */}
      <div className="mb-4">
        <button
          onClick={() => adjustSessions(m.id, 1)}
          className="w-full px-4 py-2 rounded-md border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors font-medium"
        >
          Add sessions
        </button>
        <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mt-2 text-center">
          ⚠️ Only add mentorship sessions if you logged sessions by mistake
        </p>
      </div>

      {/* Schedule Future Session */}
      <div className="pt-4 border-t border-gray-200 dark:border-neutral-800">
        <h3 className="text-sm font-medium text-gray-700 dark:text-neutral-300 mb-3">Schedule future session</h3>
        {!isAdmin && (
          <div className="mb-3">
            <label className="block text-xs text-gray-600 dark:text-neutral-400 mb-1">Your timezone</label>
            <TimezoneSelector
              value={instructorTimezone}
              onChange={(tz) => {
                setInstructorTimezone(tz);
                localStorage.setItem("instructor_timezone", tz);
              }}
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <DatePicker
            value={schedule[m.id]?.date}
            onChange={(date) => {
              setSchedule((s) => {
                const current = s[m.id] || { time: "" };
                return { ...s, [m.id]: { ...current, date } };
              });
            }}
            placeholder="Select date"
          />
          <TimePicker
            value={schedule[m.id]?.time}
            onChange={(time) => {
              setSchedule((s) => {
                const current = s[m.id] || { date: "" };
                return { ...s, [m.id]: { ...current, time } };
              });
            }}
            placeholder="Select time"
          />
        </div>
        <button
          onClick={() => scheduleSession(m)}
          disabled={!schedule[m.id]?.date || !schedule[m.id]?.time || (!isAdmin && !instructorTimezone)}
          className="w-full px-4 py-2 rounded-md bg-gray-600 dark:bg-gray-500 text-white hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          Schedule & Notify (60 min)
        </button>
        {!isAdmin && !instructorTimezone && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 text-center">
            Please select your timezone above
          </p>
        )}
      </div>
    </div>
  );
}

