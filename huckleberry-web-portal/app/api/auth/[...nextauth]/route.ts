import { authOptions } from "@/auth";
import NextAuth from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { ENV_CONFIG } from "@/src/config/environment";

// Create the NextAuth handler
const handler = NextAuth(authOptions);

// Export GET and POST handlers
// In CI/build, NextAuth will handle missing credentials gracefully
export const GET = handler;
export const POST = handler;