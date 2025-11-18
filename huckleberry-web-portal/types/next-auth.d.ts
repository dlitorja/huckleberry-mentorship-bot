// Type augmentation for NextAuth
// UserRole is defined as: "student" | "instructor" | "admin" | "unknown"

import { DefaultSession } from "next-auth";
import { JWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      role?: "student" | "instructor" | "admin" | "unknown";
    } & DefaultSession["user"];
    discordId?: string;
    role?: "student" | "instructor" | "admin" | "unknown";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    discordId?: string;
    role?: "student" | "instructor" | "admin" | "unknown";
  }
}

