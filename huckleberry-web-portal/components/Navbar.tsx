import Link from "next/link";

export function Navbar() {
  return (
    <header className="w-full border-b bg-white">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold">Huckleberry</Link>
        <nav className="text-sm flex items-center gap-4">
          <Link href="/(dashboard)/dashboard" className="hover:underline">Dashboard</Link>
          <Link href="/(dashboard)/sessions" className="hover:underline">Sessions</Link>
          <Link href="/(dashboard)/instructor" className="hover:underline">Instructor</Link>
        </nav>
      </div>
    </header>
  );
}

