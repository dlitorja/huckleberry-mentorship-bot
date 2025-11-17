"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [dark, setDark] = useState(true); // Default to dark
  const [mounted, setMounted] = useState(false);

  // Initialize theme - read actual current state from DOM/localStorage
  useEffect(() => {
    // Read from localStorage first (user preference)
    const stored = localStorage.getItem("theme");
    let isDark: boolean;
    
    if (stored) {
      // User has a preference stored
      isDark = stored === "dark";
    } else {
      // No preference - default to dark
      isDark = true;
    }
    
    // Ensure DOM matches
    document.documentElement.classList.toggle("dark", isDark);
    setDark(isDark);
    setMounted(true);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <button
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border bg-white text-gray-800 hover:bg-gray-50 dark:bg-neutral-900 dark:text-neutral-100 dark:border-neutral-800 dark:hover:bg-neutral-800"
        title="Toggle theme"
        disabled
      >
        <Moon size={16} />
        <span className="text-sm">Dark</span>
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border bg-white text-gray-800 hover:bg-gray-50 dark:bg-neutral-900 dark:text-neutral-100 dark:border-neutral-800 dark:hover:bg-neutral-800"
      title="Toggle theme"
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
      <span className="text-sm">{dark ? "Light" : "Dark"}</span>
    </button>
  );
}

