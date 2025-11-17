import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

type MentorshipData = {
  id: string;
  sessions_remaining: number | null;
  total_sessions: number | null;
  instructor: {
    id: string;
    name: string | null;
    discord_id: string | null;
  } | null;
  mentee: {
    id: string;
    display_name: string | null;
    discord_username: string | null;
    email: string | null;
    discord_id: string | null;
  } | null;
};

async function getMenteeMentorship(): Promise<MentorshipData | null> {
  const cookieStore = await cookies();
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/mentee/dashboard`, {
      headers: {
        cookie: cookieStore.toString(),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error('[Dashboard] API error:', res.status, errorData);
      return null;
    }
    const data = await res.json();
    return data.mentorship || null;
  } catch (error) {
    console.error('[Dashboard] Fetch error:', error);
    return null;
  }
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  
  const role = String((session as any)?.role || "unknown");
  const isInstructorOrAdmin = role === "instructor" || role === "admin";
  const isStudent = role === "student";
  
  // Fetch mentorship data for students
  const mentorship = isStudent ? await getMenteeMentorship() : null;
  const sessionsRemaining = mentorship?.sessions_remaining ?? 0;
  const instructorName = mentorship?.instructor?.name || "Your Instructor";
  
  // Debug logging
  if (isStudent) {
    console.log('[Dashboard] Role:', role, 'Mentorship:', mentorship);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Dashboard</h1>
      
      {/* Mentee-specific information */}
      {isStudent && mentorship && (
        <div className="p-6 rounded-lg border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/20">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {instructorName}
              </h2>
              <p className="text-sm text-gray-600 dark:text-neutral-400 mb-4">
                Your mentorship instructor
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
                  {sessionsRemaining}
                </span>
                <span className="text-lg text-gray-700 dark:text-neutral-300">
                  {sessionsRemaining === 1 ? "session" : "sessions"} remaining
                </span>
              </div>
              {mentorship.total_sessions && (
                <p className="text-sm text-gray-500 dark:text-neutral-500 mt-1">
                  out of {mentorship.total_sessions} total sessions
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      
      {isStudent && !mentorship && (
        <div className="p-4 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
          <div className="font-medium text-amber-900 dark:text-amber-200">No active mentorship</div>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
            You don&apos;t have an active mentorship yet. Contact support if you believe this is an error.
          </p>
        </div>
      )}
      
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href="/sessions" className="p-4 rounded-md border border-gray-200 dark:border-neutral-900 bg-white dark:bg-neutral-950 hover:bg-gray-50 dark:hover:bg-neutral-900 hover:shadow-sm transition-all">
          <div className="font-medium text-gray-900 dark:text-white">Your Sessions</div>
          <p className="text-sm text-gray-600 dark:text-neutral-400 mt-1">View session notes and uploads.</p>
        </Link>
        {isInstructorOrAdmin && (
          <Link href="/instructor" className="p-4 rounded-md border border-gray-200 dark:border-neutral-900 bg-white dark:bg-neutral-950 hover:bg-gray-50 dark:hover:bg-neutral-900 hover:shadow-sm transition-all">
            <div className="font-medium text-gray-900 dark:text-white">Instructor</div>
            <p className="text-sm text-gray-600 dark:text-neutral-400 mt-1">Manage mentees and schedule sessions.</p>
          </Link>
        )}
        <a href="https://discord.com/channels/@me" target="_blank" rel="noopener noreferrer" className="p-4 rounded-md border border-gray-200 dark:border-neutral-900 bg-white dark:bg-neutral-950 hover:bg-gray-50 dark:hover:bg-neutral-900 hover:shadow-sm transition-all">
          <div className="font-medium text-gray-900 dark:text-white">Open Discord</div>
          <p className="text-sm text-gray-600 dark:text-neutral-400 mt-1">Jump to your DMs to coordinate quickly.</p>
        </a>
      </div>
    </div>
  );
}

