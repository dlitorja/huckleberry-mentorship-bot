import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SignOutButton } from "@/components/SignOutButton";
import { getToken } from "next-auth/jwt";
import { cookies } from "next/headers";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const token = await getToken({ 
    req: {
      headers: {
        cookie: cookieStore.toString(),
      },
    } as any,
    secret: process.env.NEXTAUTH_SECRET 
  });
  
  const role = String((token as any)?.role || "unknown");
  const isInstructorOrAdmin = role === "instructor" || role === "admin";

  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr] bg-gray-50 dark:bg-neutral-950">
      <aside className="border-r border-gray-200 dark:border-neutral-900 bg-white dark:bg-neutral-950 p-4 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">Portal</h2>
          <ThemeToggle />
        </div>
        <nav className="grid gap-2 text-sm">
          <Link href="/dashboard" className="text-gray-700 dark:text-neutral-300 hover:text-gray-900 dark:hover:text-white hover:underline transition-colors">
            Dashboard
          </Link>
          <Link href="/sessions" className="text-gray-700 dark:text-neutral-300 hover:text-gray-900 dark:hover:text-white hover:underline transition-colors">
            Sessions
          </Link>
          {isInstructorOrAdmin && (
            <Link href="/instructor" className="text-gray-700 dark:text-neutral-300 hover:text-gray-900 dark:hover:text-white hover:underline transition-colors">
              Instructor
            </Link>
          )}
        </nav>
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-neutral-800">
          <SignOutButton />
        </div>
      </aside>
      <main className="p-6 bg-gray-50 dark:bg-neutral-950">{children}</main>
    </div>
  );
}

