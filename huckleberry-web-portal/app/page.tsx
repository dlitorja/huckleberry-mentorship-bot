import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-950">
      <div className="p-8 rounded-xl border border-gray-200 dark:border-neutral-900 bg-white dark:bg-neutral-950 shadow-sm max-w-md w-full text-center">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Huckleberry Mentorship Portal</h1>
        <p className="text-sm text-gray-600 dark:text-neutral-400 mt-2">Students and instructors can view sessions, notes, and images.</p>
        <div className="mt-6">
          <Link href="/login" className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors">
            Sign in with Discord
          </Link>
        </div>
      </div>
    </main>
  );
}

