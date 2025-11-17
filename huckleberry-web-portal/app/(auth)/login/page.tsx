"use client";
import { useEffect } from "react";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const callbackUrl = url.searchParams.get("callbackUrl") ?? "/dashboard";
    // Trigger Discord OAuth immediately
    signIn("discord", { callbackUrl, redirect: true });
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="p-8 rounded-xl border bg-white shadow-sm max-w-md w-full text-center">
        <p className="text-sm text-gray-700">Redirecting to Discord…</p>
      </div>
    </main>
  );
}

